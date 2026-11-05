import { expect, test, type Page } from "@playwright/test";
import { api, emailFor, makeUser, removeUsers, signIn, STAMP } from "./helpers";

const created: string[] = [];

test.beforeAll(async () => {
  await makeUser("editor", { role: "editor" });
  await makeUser("admin", { role: "admin" });
});

test.afterAll(async () => {
  for (const id of created) await api(`/rest/v1/articles?id=eq.${id}`, { method: "DELETE" });
  await removeUsers();
});

const makeNote = async (title: string, content = "<p>Texto original.</p>") => {
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title,
      slug: `e2e-${STAMP}-${created.length}`,
      content,
      status: "draft",
    }),
  });
  created.push(note.id);
  return note.id as string;
};

const openNote = async (page: Page, id: string) => {
  // Saving waits for the note's tags, so the test does too.
  const tags = page.waitForResponse("**/rest/v1/article_tags**");
  await page.goto(`/articulos/${id}`);
  await tags;
  await expect(page.getByRole("heading", { name: "Editar nota" })).toBeVisible();
  await expect(page.locator(".note-editor")).toBeVisible();
};

test("writing a note from nothing, then publishing it", async ({ page }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/articulos/nueva");

  const title = `E2E nota nueva ${STAMP}`;
  await page.getByPlaceholder("Título de la nota").fill(title);
  await page.locator(".note-editor").click();
  await page.keyboard.type("El primer párrafo de la nota.");
  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(page.getByRole("heading", { name: "Antes de publicar" })).toBeVisible();
  await expect(page.getByText("No tiene foto de portada.")).toBeVisible();
  await page.getByRole("button", { name: "Publicar igual" }).click();

  await expect(page).toHaveURL(/\/articulos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Editar nota" })).toBeVisible();
  await expect(page.getByText("Todo guardado")).toBeVisible();
  created.push(page.url().split("/").pop() ?? "");

  const [stored] = await api(
    `/rest/v1/articles?id=eq.${created.at(-1)}&select=status,content,published_at`,
  );
  expect(stored.status).toBe("published");
  expect(stored.content).toContain("El primer párrafo");
  expect(stored.published_at).toBeTruthy();
});

test("a note appears in the list and can be found", async ({ page }) => {
  const title = `E2E lista ${STAMP}`;
  await makeNote(title);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.getByRole("link", { name: "Artículos" }).click();
  await page.getByRole("searchbox", { name: "Buscar notas" }).fill(title);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await expect(page).toHaveURL(/q=/);
  await page.getByRole("searchbox", { name: "Buscar notas" }).fill(`${title} inexistente`);
  await expect(page.getByText("Ninguna nota coincide con esos filtros")).toBeVisible();
});

test("an editor can archive but not delete; an administrator can delete", async ({ page }) => {
  const title = `E2E lote ${STAMP}`;
  const id = await makeNote(title);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto(`/articulos?q=${encodeURIComponent(title)}`);
  await page.getByRole("checkbox", { name: `Elegir ${title}` }).check();
  await expect(page.getByRole("button", { name: "Borrar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Archivar" }).click();
  await expect(page.getByText("Notas archivadas.")).toBeVisible();
  const [stored] = await api(`/rest/v1/articles?id=eq.${id}&select=status`);
  expect(stored.status).toBe("archived");

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto(`/articulos?q=${encodeURIComponent(title)}`);
  await page.getByRole("checkbox", { name: `Elegir ${title}` }).check();
  await page.getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Notas borradas.")).toBeVisible();
  expect(await api(`/rest/v1/articles?id=eq.${id}&select=id`)).toEqual([]);
});

test("when someone else saved first, nobody loses their text", async ({ page }) => {
  const id = await makeNote(`E2E conflicto ${STAMP}`);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);

  await page.locator(".note-editor").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Lo mío.");
  await api(`/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "<p>Lo de la otra persona.</p>" }),
  });

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Otra persona guardó esta nota" })).toBeVisible();
  await page.getByRole("button", { name: "Ver lo que guardó" }).click();
  await expect(page.getByRole("alertdialog").getByText("Lo de la otra persona.")).toBeVisible();

  await page.getByRole("button", { name: "Seguir editando" }).click();
  await expect(page.locator(".note-editor")).toContainText("Lo mío.");
  const [before] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(before.content).toContain("otra persona");

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar lo mío" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  const [after] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(after.content).toContain("Lo mío.");
});

test("without internet the text stays and comes back after reloading", async ({ page }) => {
  const id = await makeNote(`E2E sin red ${STAMP}`);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);

  await page.locator(".note-editor").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Escrito sin conexión.");
  await page.waitForTimeout(1200);

  await page.route("**/rest/v1/articles**", (route) => route.abort());
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText(/No pudimos guardar/)).toBeVisible();
  await expect(page.locator(".note-editor")).toContainText("Escrito sin conexión.");
  await page.unroute("**/rest/v1/articles**");

  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByText("Recuperamos lo que estabas escribiendo")).toBeVisible();
  await expect(page.locator(".note-editor")).toContainText("Escrito sin conexión.");
});

test("an old note with media opens and saves without losing it", async ({ page }) => {
  const id = await makeNote(
    `E2E medios ${STAMP}`,
    `<h3>Sub</h3><p><span style="font-weight: bolder;">Fuerte</span> y normal.</p><div data-media-block="true" contenteditable="false"><figure class="m"><img src="https://x.supabase.co/a.webp" alt="Foto"></figure><button type="button" data-remove-media="true" aria-label="Quitar">×</button></div><div data-media-block="true" contenteditable="false"><iframe src="https://www.instagram.com/reel/abc/embed/" title="R"></iframe><button type="button" data-remove-media="true" aria-label="Quitar">×</button></div>`,
  );
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
  await page.locator(".note-editor").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Nuevo. ");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  const [stored] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(stored.content).toContain(`src="https://x.supabase.co/a.webp"`);
  expect(stored.content).toContain(`alt="Foto"`);
  expect(stored.content).toContain(`src="https://www.instagram.com/reel/abc/embed/"`);
  expect(stored.content).toContain("<strong>Fuerte</strong>");
  expect(stored.content).not.toContain("×");
});

test("an earlier version can be compared and brought back", async ({ page }) => {
  const id = await makeNote(`E2E historial ${STAMP}`, "<p>Primera redacción.</p>");
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);

  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.getByText("Todavía no hay versiones anteriores")).toBeVisible();

  await page.locator(".note-editor").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Segunda redacción.");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.getByRole("button", { name: /Cambiada por/ }).click();
  await expect(page.getByRole("dialog").locator("del")).toContainText("Primera");
  await expect(page.getByRole("dialog").locator("ins")).toContainText("Segunda");
  await page.getByRole("button", { name: "Usar esta versión" }).click();

  await expect(page.locator(".note-editor")).toContainText("Primera redacción.");
  await expect(page.getByText("Cambios sin guardar")).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Todo guardado")).toBeVisible();

  const [stored] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(stored.content).toContain("Primera redacción.");
  const versions = await api(`/rest/v1/article_revisions?article_id=eq.${id}&select=id`);
  expect(versions).toHaveLength(2);
});

const mockAssistant = (page: Page, result: unknown, status = 200) =>
  page.route("**/functions/v1/editor-assist", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(status === 200 ? { result } : result),
    }),
  );

test("the assistant suggests and nothing changes until it is accepted", async ({ page }) => {
  const id = await makeNote(`E2E asistente ${STAMP}`, "<p>El presidente hablo ayer.</p>");
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
  await page.getByRole("tab", { name: "IA", exact: true }).click();

  await mockAssistant(page, { titles: ["Título sugerido", "Otro título"] });
  await page.getByRole("button", { name: "Títulos" }).click();
  await expect(page.getByText("Título sugerido")).toBeVisible();
  await expect(page.getByPlaceholder("Título de la nota")).toHaveValue(`E2E asistente ${STAMP}`);
  await page
    .getByRole("listitem")
    .filter({ hasText: "Otro título" })
    .getByRole("button", { name: "Descartar" })
    .click();
  await expect(page.getByText("Otro título")).toHaveCount(0);
  await page.getByRole("button", { name: "Usar" }).click();
  await expect(page.getByPlaceholder("Título de la nota")).toHaveValue("Título sugerido");

  await page.unroute("**/functions/v1/editor-assist");
  await mockAssistant(page, {
    fixes: [{ original: "hablo", replacement: "habló", reason: "Falta la tilde" }],
  });
  await page.getByRole("button", { name: "Ortografía" }).click();
  await expect(page.getByText("Falta la tilde")).toBeVisible();
  await expect(page.locator(".note-editor")).toContainText("hablo ayer");
  await page.getByRole("button", { name: "Corregir" }).click();
  await expect(page.locator(".note-editor")).toContainText("habló ayer");
});

test("when the assistant fails, the note is untouched and writing goes on", async ({ page }) => {
  const id = await makeNote(`E2E asistente caído ${STAMP}`, "<p>Texto intacto.</p>");
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
  await page.getByRole("tab", { name: "IA", exact: true }).click();

  await mockAssistant(page, { error: "El asistente no respondió." }, 502);
  await page.getByRole("button", { name: "Resumen" }).click();
  await expect(page.getByRole("alert")).toContainText("Podés seguir escribiendo");
  await page.locator(".note-editor").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Más texto.");
  await expect(page.locator(".note-editor")).toContainText("Texto intacto. Más texto.");
});

// One white pixel, as a real upload.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

test("an image uploaded from the computer reaches the library and the note", async ({ page }) => {
  const id = await makeNote(`E2E imagen ${STAMP}`);
  const alt = `Foto E2E ${STAMP}`;
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);

  await page.getByRole("button", { name: "Elegir foto" }).click();
  await page.getByRole("tab", { name: "Subir" }).click();
  await page.getByLabel("Descripción de la imagen").fill(alt);
  await page
    .getByLabel("Elegir archivo")
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto de portada elegida")).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  const [note] = await api(`/rest/v1/articles?id=eq.${id}&select=cover_image_url`);
  expect(note.cover_image_url).toContain("/article-media/");
  expect(note.cover_image_url).toContain(".webp");

  await page.goto("/imagenes");
  await page.getByRole("searchbox", { name: "Buscar imágenes" }).fill(alt);
  await page.getByRole("button", { name: alt }).click();
  await expect(page.getByRole("dialog").getByText(`E2E imagen ${STAMP}`)).toBeVisible();
  await page.getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Se dejará de ver en 1 nota")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Imagen borrada.")).toBeVisible();
});

test("an address that is not an image is refused", async ({ page }) => {
  const id = await makeNote(`E2E imagen rota ${STAMP}`);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
  await page.getByRole("button", { name: "Elegir foto" }).click();
  await page.getByRole("tab", { name: "Dirección web" }).click();
  await page.getByLabel("Dirección de la imagen").fill("http://inseguro.test/a.png");
  await page.getByRole("button", { name: "Usar esta imagen" }).click();
  await expect(page.getByRole("alert")).toContainText("https://");
});

test("choosing the homepage and breaking news", async ({ page }) => {
  const title = `E2E portada ${STAMP}`;
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title,
      slug: `e2e-portada-${STAMP}`,
      content: "<p>x</p>",
      status: "published",
      published_at: new Date(Date.now() - 86_400_000 * 400).toISOString(),
    }),
  });
  created.push(note.id);

  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/portada");
  const main = page.getByRole("article", { name: "Nota principal" });
  await expect(main).toBeVisible();
  await main.getByRole("button", { name: /Elegir|Cambiar/ }).click();
  await page.getByRole("searchbox", { name: "Buscar nota" }).fill(title);
  await page.getByRole("button", { name: title }).click();
  await expect(main).toContainText(title);
  await page.getByRole("button", { name: "Guardar portada" }).click();
  await expect(page.getByText("Portada actualizada.")).toBeVisible();
  const slots = await api("/rest/v1/homepage_slots?position=eq.1&select=article_id");
  expect(slots[0].article_id).toBe(note.id);

  await page.getByRole("button", { name: "Agregar" }).click();
  await page.getByRole("searchbox", { name: "Buscar nota" }).fill(title);
  await page.getByRole("button", { name: title }).click();
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await api(`/rest/v1/articles?id=eq.${note.id}&select=is_breaking`))[0].is_breaking,
    )
    .toBe(true);
  const [stored] = await api(`/rest/v1/articles?id=eq.${note.id}&select=breaking_until`);
  const hours = (new Date(stored.breaking_until).getTime() - Date.now()) / 3_600_000;
  expect(Math.round(hours)).toBe(24);

  await api("/rest/v1/homepage_slots?position=gte.1", { method: "DELETE" });
});

const edit = async (page: Page, text: string) => {
  await page.locator(".note-editor").click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
};

const saveButton = (page: Page) => page.getByRole("button", { name: "Guardar", exact: true });

const enter = async (page: Page, id: string) => {
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
};

const reconnect = (page: Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
  });

test("a save by someone else is noticed even if the page refreshed its data", async ({ page }) => {
  const id = await makeNote(`E2E token ${STAMP}`);
  await enter(page, id);
  await api(`/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "<p>Lo de Beto.</p>" }),
  });
  await reconnect(page);
  await page.waitForTimeout(1500);
  await edit(page, " Lo de Ana.");
  await saveButton(page).click();
  await expect(page.getByRole("heading", { name: "Otra persona guardó esta nota" })).toBeVisible();
  const [stored] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(stored.content).toContain("Lo de Beto.");
});

test("reopening a note shows what is saved now, not an old copy", async ({ page }) => {
  const id = await makeNote(`E2E reabrir ${STAMP}`);
  await enter(page, id);
  await page.getByRole("link", { name: "Volver a Artículos" }).click();
  await expect(page.getByRole("heading", { name: "Artículos" })).toBeVisible();
  await api(`/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "<p>Versión de Beto.</p>" }),
  });
  await page.getByRole("searchbox", { name: "Buscar notas" }).fill(`E2E reabrir ${STAMP}`);
  await page.getByRole("link", { name: `E2E reabrir ${STAMP}` }).click();
  await expect(page.locator(".note-editor")).toContainText("Versión de Beto.");
});

test("words typed while saving stay on screen and stay pending", async ({ page }) => {
  const id = await makeNote(`E2E durante ${STAMP}`);
  await enter(page, id);
  await edit(page, " Primero.");
  await page.route("**/rest/v1/articles**", async (route) => {
    if (route.request().method() === "PATCH") await new Promise((done) => setTimeout(done, 1500));
    await route.continue();
  });
  await page.keyboard.press("Control+s");
  await page.keyboard.type(" Durante.");
  await expect(page.getByText("Guardado.")).toBeVisible();
  await expect(page.locator(".note-editor")).toContainText("Durante.");
  await expect(page.getByText("Cambios sin guardar")).toBeVisible();
});

test("publishing an existing draft leaves nothing pending", async ({ page }) => {
  const id = await makeNote(`E2E publicar ${STAMP}`);
  await enter(page, id);
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.getByRole("button", { name: "Publicar igual" }).click();
  await expect(page.getByText("Nota publicada.")).toBeVisible();
  await expect(page.getByText("Todo guardado")).toBeVisible();
});

test("pressing save twice does not look like someone else saved", async ({ page }) => {
  const id = await makeNote(`E2E doble ${STAMP}`);
  await enter(page, id);
  await edit(page, " Doble.");
  await page.route("**/rest/v1/articles**", async (route) => {
    if (route.request().method() === "PATCH") await new Promise((done) => setTimeout(done, 800));
    await route.continue();
  });
  await page.keyboard.press("Control+s");
  await page.keyboard.press("Control+s");
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByRole("heading", { name: "Otra persona guardó esta nota" })).toHaveCount(0);
});

test("when only the tags fail, it says so and the next save works", async ({ page }) => {
  const id = await makeNote(`E2E etiquetas ${STAMP}`);
  await enter(page, id);
  await edit(page, " Con etiquetas.");
  await page.route("**/rpc/replace_article_tags", (route) => route.abort());
  await saveButton(page).click();
  await expect(page.getByText(/se guardó, pero no las etiquetas/)).toBeVisible();
  const [stored] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(stored.content).toContain("Con etiquetas.");

  await page.unroute("**/rpc/replace_article_tags");
  await edit(page, " Otra vez.");
  await saveButton(page).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Otra persona guardó esta nota" })).toHaveCount(0);
});

test("choosing the other person's version really loads it", async ({ page }) => {
  const id = await makeNote(`E2E lo suyo ${STAMP}`);
  await enter(page, id);
  await edit(page, " Lo mío.");
  await api(`/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "<p>Lo suyo.</p>" }),
  });
  await saveButton(page).click();
  await page.getByRole("button", { name: "Usar lo suyo" }).click();
  await expect(page.locator(".note-editor")).toContainText("Lo suyo.");
  await expect(page.locator(".note-editor")).not.toContainText("Lo mío.");
});

test("saving a note someone deleted explains it and keeps the text", async ({ page }) => {
  const id = await makeNote(`E2E borrada ${STAMP}`);
  await enter(page, id);
  await edit(page, " Sigue acá.");
  await api(`/rest/v1/articles?id=eq.${id}`, { method: "DELETE" });
  await saveButton(page).click();
  await expect(page.getByText(/ya no existe/)).toBeVisible();
  await expect(page.locator(".note-editor")).toContainText("Sigue acá.");
});

test("a failed background refresh does not take the editor away", async ({ page }) => {
  const id = await makeNote(`E2E sin fondo ${STAMP}`);
  await enter(page, id);
  await edit(page, " Escribiendo.");
  await page.route("**/rest/v1/articles**", (route) => route.abort());
  await reconnect(page);
  await page.waitForTimeout(2500);
  await expect(page.locator(".note-editor")).toContainText("Escribiendo.");
  await page.unroute("**/rest/v1/articles**");
});

test("the preview stays readable in dark mode", async ({ page }) => {
  const id = await makeNote(`E2E oscuro ${STAMP}`);
  await page.emulateMedia({ colorScheme: "dark" });
  await enter(page, id);
  await page.getByRole("button", { name: "Vista previa" }).click();
  const background = await page
    .getByRole("dialog")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toBe("rgb(255, 255, 255)");
});

test("an editor can choose a colleague as author", async ({ page }) => {
  const id = await makeNote(`E2E autor ${STAMP}`);
  await enter(page, id);
  await expect(page.getByLabel("Autor").getByRole("option", { name: "admin E2E" })).toHaveCount(1);
});

test("a scheduled note appears in the calendar and can change date", async ({ page }) => {
  const title = `E2E calendario ${STAMP}`;
  const when = new Date(Date.now() + 3 * 86_400_000);
  when.setUTCHours(13, 30, 0, 0);
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title,
      slug: `e2e-calendario-${STAMP}`,
      content: "<p>x</p>",
      status: "scheduled",
      scheduled_at: when.toISOString(),
    }),
  });
  created.push(note.id);

  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/calendario");
  // Three days ahead can fall in next month.
  if ((await page.getByRole("link", { name: title }).count()) === 0) {
    await page.waitForTimeout(800);
    if ((await page.getByRole("link", { name: title }).count()) === 0) {
      await page.getByRole("button", { name: "Mes siguiente" }).click();
    }
  }
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  const later = new Date(when.getTime() + 2 * 86_400_000);
  const day = later.toISOString().slice(0, 10);
  await page.getByRole("button", { name: `Cambiar la fecha de ${title}` }).click();
  await page.getByLabel("Nueva fecha").fill(day);
  await page.getByRole("button", { name: "Cambiar fecha" }).click();
  await expect(page.getByText("Fecha cambiada.")).toBeVisible();

  const [stored] = await api(`/rest/v1/articles?id=eq.${note.id}&select=scheduled_at`);
  expect(new Date(stored.scheduled_at).toISOString()).toBe(later.toISOString());
});

test("a new comment appears by itself; an administrator removes it and blocks the author", async ({
  page,
}) => {
  const articleId = await makeNote(`E2E comentarios ${STAMP}`);
  await api(`/rest/v1/articles?id=eq.${articleId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
  });
  const author = await makeUser("autor");
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/comentarios");
  await expect(page.getByRole("heading", { name: "Comentarios" })).toBeVisible();

  // Right away on purpose: it can arrive before the live connection is ready.
  const body = `Comentario E2E ${STAMP}`;
  await api("/rest/v1/comments", {
    method: "POST",
    body: JSON.stringify({ article_id: articleId, user_id: author, body }),
  });
  const row = page.getByRole("listitem").filter({ hasText: body });
  await expect(row).toBeVisible({ timeout: 20_000 });

  await row.getByRole("button", { name: "Bloquear al autor" }).click();
  await page.getByLabel("Motivo").fill("Motivo E2E");
  await page.getByRole("alertdialog").getByRole("button", { name: "Bloquear" }).click();
  await expect(page.getByText("Cuenta bloqueada.")).toBeVisible();
  const [profile] = await api(`/rest/v1/profiles?id=eq.${author}&select=is_blocked,blocked_reason`);
  expect(profile).toEqual({ is_blocked: true, blocked_reason: "Motivo E2E" });

  await row.getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Comentario borrado.")).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("an editor reads comments but gets no way to remove them", async ({ page }) => {
  const articleId = await makeNote(`E2E solo leer ${STAMP}`);
  const author = await makeUser("autor2");
  const body = `Solo leer ${STAMP}`;
  await api("/rest/v1/comments", {
    method: "POST",
    body: JSON.stringify({ article_id: articleId, user_id: author, body }),
  });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/comentarios");
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Borrar" })).toHaveCount(0);
});

test("windows keep their content away from the edges", async ({ page }) => {
  const expectInset = async (name: string, last: string) => {
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      const box = (await dialog.boundingBox())!;
      const title = (await dialog.getByRole("heading", { name }).boundingBox())!;
      const end = (await dialog.getByRole("button", { name: last }).boundingBox())!;
      expect(title.x - box.x).toBeGreaterThanOrEqual(16);
      expect(title.y - box.y).toBeGreaterThanOrEqual(16);
      expect(box.x + box.width - (end.x + end.width)).toBeGreaterThanOrEqual(16);
      expect(box.y + box.height - (end.y + end.height)).toBeGreaterThanOrEqual(16);
    }).toPass();
  };

  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/categorias");
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await expectInset("Nueva categoría", "Guardar");

  const id = await makeNote(`E2E ventana ${STAMP}`);
  await openNote(page, id);
  await page.getByRole("button", { name: "Elegir foto" }).click();
  await page.getByRole("dialog").getByRole("tab", { name: "Dirección web" }).click();
  await expectInset("Foto de portada", "Usar esta imagen");
});

test("an administrator manages roles, blocks, categories and subscribers", async ({ page }) => {
  const gestion = await makeUser("gestion");
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();

  await page.goto("/usuarios");
  await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill(emailFor("gestion"));
  const person = page.getByRole("row").filter({ hasText: emailFor("gestion") });
  await expect(person).toBeVisible();
  await person.getByRole("combobox").selectOption("editor");
  await expect(page.getByRole("heading", { name: /Cambiar el rol/ })).toBeVisible();
  const [before] = await api(`/rest/v1/profiles?id=eq.${gestion}&select=role`);
  expect(before.role).toBe("reader");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(person.getByRole("combobox")).toHaveValue("reader");
  await person.getByRole("combobox").selectOption("editor");
  await page.getByRole("button", { name: "Cambiar rol" }).click();
  await expect(page.getByText("Rol cambiado.")).toBeVisible();

  await page.goto("/categorias");
  const name = `Sección E2E ${STAMP}`;
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("button", { name: `Editar ${name}` })).toBeVisible();
  await page.getByRole("button", { name: `Borrar ${name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByRole("button", { name: `Editar ${name}` })).toHaveCount(0);

  const email = `e2e-news-${STAMP}@test.invalid`;
  await api("/rest/v1/newsletter_subscribers", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  await page.goto("/newsletter");
  await expect(page.getByText(email)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await download).suggestedFilename()).toBe("suscriptores-qap.csv");
  await page.getByRole("button", { name: `Quitar ${email}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByText(email)).toHaveCount(0);
});

test("a deleted note can be restored from the activity log", async ({ page }) => {
  const title = `E2E restaurar ${STAMP}`;
  const id = await makeNote(title, "<p>Texto que vuelve.</p>");
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto(`/articulos?q=${encodeURIComponent(title)}`);
  await page.getByRole("checkbox", { name: `Elegir ${title}` }).check();
  await page.getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Notas borradas.")).toBeVisible();

  await page.goto("/actividad");
  const row = page.getByRole("listitem").filter({ hasText: `borró la nota ${title}` });
  await expect(row).toContainText(emailFor("admin"));
  await row.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Nota restaurada como borrador.")).toBeVisible();
  const [note] = await api(`/rest/v1/articles?id=eq.${id}&select=status,content`);
  expect(note.status).toBe("draft");
  expect(note.content).toContain("Texto que vuelve.");

  await api(`/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content: "<p>Editada después.</p>" }),
  });
  await row.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText(/ya existe/)).toBeVisible();
  const [kept] = await api(`/rest/v1/articles?id=eq.${id}&select=content`);
  expect(kept.content).toContain("Editada después.");

  await page.getByRole("tab", { name: "Control de acceso" }).click();
  await page.getByRole("searchbox", { name: "Buscar accesos" }).fill(emailFor("admin"));
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: emailFor("admin") })
      .first(),
  ).toBeVisible();
});

test("Ctrl K finds a note and goes to it with the keyboard", async ({ page }) => {
  const title = `E2E paleta ${STAMP}`;
  const id = await makeNote(title);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Buscar notas, usuarios o acciones" }).fill(title);
  await expect(page.getByRole("option", { name: title })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/articulos/${id}$`));
});

test("an editor cannot open administrator screens by address", async ({ page }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  for (const path of ["/usuarios", "/newsletter", "/actividad", "/categorias"]) {
    await page.goto(path);
    await expect(page.getByText("Esta pantalla es solo para administradores.")).toBeVisible();
  }
});

test("reads per day reach the chart and the rankings", async ({ page }) => {
  const title = `E2E lecturas ${STAMP}`;
  const id = await makeNote(title);
  await api(`/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
  });
  const day = (ago: number) =>
    new Date(Date.now() - ago * 86_400_000 - 3 * 3_600_000).toISOString().slice(0, 10);
  await api("/rest/v1/article_views_daily", {
    method: "POST",
    body: JSON.stringify(
      [0, 1, 2, 3].map((ago) => ({ article_id: id, day: day(ago), views: 1000 + ago })),
    ),
  });

  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await expect(page.getByText("Ver como tabla")).toBeVisible();

  await page.goto("/estadisticas");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await expect(page.getByText(/lecturas en 30 días/)).toBeVisible();
  await page.getByRole("button", { name: "12 meses" }).click();
  await expect(page.getByText("Ver como tabla")).toBeVisible();
});

test("editing the end of breaking news saves only when finished, and clearing it removes nothing", async ({
  page,
}) => {
  const title = `E2E hasta ${STAMP}`;
  const until = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title,
      slug: `e2e-hasta-${STAMP}`,
      content: "<p>x</p>",
      status: "published",
      published_at: new Date().toISOString(),
      is_breaking: true,
      breaking_until: until,
    }),
  });
  created.push(note.id);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/portada");
  const row = page.getByRole("listitem").filter({ hasText: title });
  const input = row.getByLabel(/Hasta/);

  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH" && request.url().includes("/rest/v1/articles")) writes += 1;
  });
  await input.fill("");
  await input.blur();
  await page.waitForTimeout(500);
  expect(writes).toBe(0);
  await expect(row).toBeVisible();
  const [same] = await api(`/rest/v1/articles?id=eq.${note.id}&select=is_breaking`);
  expect(same.is_breaking).toBe(true);

  await input.fill("2030-01-15T10:30");
  expect(writes).toBe(0);
  await input.blur();
  await expect.poll(() => writes).toBe(1);
  await api("/rest/v1/homepage_slots?position=gte.1", { method: "DELETE" });
});

test("when the image's use cannot be checked, deleting it waits", async ({ page }) => {
  const alt = `Foto sin comprobar ${STAMP}`;
  const [asset] = await api("/rest/v1/media_assets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ url: `https://x.test/${STAMP}.webp`, source: "url", alt }),
  });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/imagenes");
  await page.route("**/rest/v1/articles**", (route) => route.abort());
  await page.getByRole("searchbox", { name: "Buscar imágenes" }).fill(alt);
  await page.getByRole("button", { name: alt }).click();
  // The client retries a lost connection before giving up.
  await expect(page.getByText(/No pudimos comprobar/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("dialog").getByRole("button", { name: "Borrar" })).toBeDisabled();
  await api(`/rest/v1/media_assets?id=eq.${asset.id}`, { method: "DELETE" });
});

test("the picker reaches older images and a cover cannot be a video", async ({ page }) => {
  const stamp = String(STAMP);
  const rows = Array.from({ length: 26 }, (_, index) => ({
    url: `https://x.test/${stamp}-${index}.webp`,
    source: "url",
    alt: `Vieja ${stamp} ${index}`,
  }));
  const assets = await api("/rest/v1/media_assets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  const [video] = await api("/rest/v1/media_assets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      url: `https://x.test/${stamp}.mp4`,
      source: "url",
      mime_type: "video/mp4",
      alt: `Video ${stamp}`,
    }),
  });
  try {
    const id = await makeNote(`E2E selector ${stamp}`);
    await enter(page, id);
    await page.getByRole("button", { name: "Elegir foto" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("searchbox", { name: "Buscar en la biblioteca" }).fill(stamp);
    const old = dialog.getByRole("button", { name: new RegExp(`^Elegir Vieja ${stamp}`) });
    await expect(old).toHaveCount(24);
    await expect(dialog.getByRole("button", { name: `Elegir Video ${stamp}` })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Siguiente" }).click();
    await expect(old).toHaveCount(2);
  } finally {
    await api(
      `/rest/v1/media_assets?id=in.(${[...assets.map((a: { id: string }) => a.id), video.id].join(",")})`,
      { method: "DELETE" },
    );
  }
});

test("finish: a note signed by the newsroom stays that way when someone else saves it", async ({
  page,
}) => {
  const id = await makeNote(`E2E redaccion ${STAMP}`);
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
  const author = page.getByRole("combobox", { name: "Autor" });
  await expect(author.locator("option:checked")).toHaveText("Redacción");
  await page.getByPlaceholder("Título de la nota").fill(`E2E redaccion cambiada ${STAMP}`);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();
  const [note] = await api(`/rest/v1/articles?id=eq.${id}&select=author_id,title`);
  expect(note.title).toContain("cambiada");
  expect(note.author_id).toBeNull();
});

test("finish: Hoy shows the rise in reads and says which period its lists cover", async ({
  page,
}) => {
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: `E2E subida ${STAMP}`,
      slug: `e2e-subida-${STAMP}`,
      content: "<p>x</p>",
      status: "published",
      published_at: new Date().toISOString(),
    }),
  });
  created.push(note.id);
  const dayAgo = (days: number) =>
    new Date(Date.now() - 3 * 3_600_000 - days * 86_400_000).toISOString().slice(0, 10);
  await api("/rest/v1/article_views_daily?on_conflict=article_id,day", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(
      Array.from({ length: 14 }, (_, days) => ({
        article_id: note.id,
        day: dayAgo(days),
        views: days < 7 ? 5000 : 1000,
      })),
    ),
  });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  const reads = page.locator("section").filter({ hasText: "Lecturas, 7 días" });
  await expect(reads).toContainText(/\+\d+%/);
  await expect(reads).toContainText("desde el inicio");
  await expect(page.locator("section").filter({ hasText: "Comentarios, 24 h" })).toContainText(
    "24 h anteriores",
  );
  await expect(page.getByText("Solo los confirmados")).toBeVisible();
  await expect(page.locator("section").filter({ hasText: "Más leídas" }).last()).toContainText(
    "Desde el inicio",
  );
});

test("finish: Newsletter says how many subscribers are confirmed", async ({ page }) => {
  const email = `e2e-sub-${STAMP}@test.invalid`;
  const [row] = await api("/rest/v1/newsletter_subscribers", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ email }),
  });
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/newsletter");
  await expect(page.getByText(/suscriptor(es)?, \d+ confirmados?/)).toBeVisible();
  await api(`/rest/v1/newsletter_subscribers?id=eq.${row.id}`, { method: "DELETE" });
});

test("finish: a long title grows instead of being cut, and stays on one paragraph", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/articulos/nueva");
  const title = page.getByPlaceholder("Título de la nota");
  await title.fill(
    "Un título bastante largo que no entra en una sola línea cuando se escribe desde el teléfono",
  );
  await title.press("Enter");
  await expect(title).not.toHaveValue(/\n/);
  const cut = await title.evaluate((node) =>
    Math.max(node.scrollHeight - node.clientHeight, node.scrollWidth - node.clientWidth),
  );
  expect(cut).toBeLessThanOrEqual(0);
});

test("finish: saving stays at hand on a long note", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await makeNote(`E2E larga ${STAMP}`, "<p>Párrafo.</p>".repeat(120));
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await openNote(page, id);
  await page.evaluate(() => window.scrollTo(0, 2500));
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeInViewport();
  await expect(page.getByRole("combobox", { name: "Estado" })).toBeInViewport();
  await expect(page.getByRole("tab", { name: "Historial" })).toBeInViewport();
  const tabTops = await page
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().top));
  expect(new Set(tabTops).size).toBe(1);
});

test("finish: the keyboard's position is visible, selects are drawn, and a lost image says so", async ({
  page,
}) => {
  const alt = `Foto perdida ${STAMP}`;
  const [asset] = await api("/rest/v1/media_assets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ url: `https://x.test/${STAMP}-perdida.webp`, source: "url", alt }),
  });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/articulos");
  const select = page.getByRole("combobox", { name: "Filtrar por estado" });
  expect(await select.evaluate((node) => getComputedStyle(node).appearance)).toBe("none");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return [style.outlineStyle, style.outlineWidth];
  });
  expect(outline).toEqual(["solid", "2px"]);
  await page.goto("/imagenes");
  await page.getByRole("searchbox", { name: "Buscar imágenes" }).fill(alt);
  await expect(
    page.getByRole("button", { name: alt }).getByRole("img", { name: "Imagen no disponible" }),
  ).toBeVisible();
  await api(`/rest/v1/media_assets?id=eq.${asset.id}`, { method: "DELETE" });
});

test("finish: on a phone the calendar is a list, filters fold away and names stay whole", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const title = `E2E agenda ${STAMP}`;
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title,
      slug: `e2e-agenda-${STAMP}`,
      content: "<p>x</p>",
      status: "published",
      published_at: new Date().toISOString(),
    }),
  });
  created.push(note.id);
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();

  const urgent = await page.getByRole("heading", { name: "Requiere atención" }).boundingBox();
  const figures = await page.getByText("Lecturas, 7 días").boundingBox();
  expect(urgent?.y ?? Infinity).toBeLessThan(figures?.y ?? 0);

  await page.goto("/calendario");
  await expect(page.getByRole("link", { name: title })).toBeInViewport();
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.goto("/articulos");
  const status = page.getByRole("combobox", { name: "Filtrar por estado" });
  await expect(status).toBeHidden();
  await page.getByRole("button", { name: /Filtros/ }).click();
  await expect(status).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("combobox", { name: "Buscar notas, usuarios o acciones" }).fill("admin E2E");
  const person = page.getByRole("option", { name: /admin E2E/ });
  const cut = await person
    .locator("span")
    .first()
    .evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(cut).toBeLessThanOrEqual(0);
});

test("finish: a busy day stays short, and the rest is one click away", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const titles = Array.from({ length: 5 }, (_, index) => `E2E dia lleno ${index} ${STAMP}`);
  const notes = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      titles.map((title, index) => ({
        title,
        slug: `e2e-dia-${index}-${STAMP}`,
        content: "<p>x</p>",
        status: "published",
        published_at: new Date().toISOString(),
      })),
    ),
  });
  created.push(...notes.map((note: { id: string }) => note.id));
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/calendario");
  await page
    .getByRole("button", { name: /^\+\d+ más/ })
    .first()
    .waitFor();
  const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const cell = page.locator(`td[data-day='${today}']`);
  await expect(cell.getByRole("link")).toHaveCount(4);
  await cell.getByRole("button", { name: /^\+\d+ más/ }).click();
  for (const title of titles) {
    await expect(page.getByRole("dialog").getByRole("link", { name: title })).toBeVisible();
  }
});

test("finish: Revisar lands on breaking news, even on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const [note] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      title: `E2E sin fin ${STAMP}`,
      slug: `e2e-sin-fin-${STAMP}`,
      content: "<p>x</p>",
      status: "published",
      published_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      is_breaking: true,
      breaking_until: null,
    }),
  });
  created.push(note.id);
  await api(`/rest/v1/articles?id=eq.${note.id}`, {
    method: "PATCH",
    body: JSON.stringify({ breaking_until: null }),
  });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.getByRole("link", { name: "Revisar" }).click();
  await expect(page).toHaveURL(/\/portada#ultima-hora$/);
  await expect(page.getByRole("heading", { name: "Última hora" })).toBeInViewport();
});

test("finish: on an office laptop every tab of the editor can be seen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.goto("/articulos/nueva");
  const strip = page.getByRole("tablist", { name: "Datos de la nota" });
  await expect(strip.getByRole("tab", { name: /Revisión \(\d+\)/ })).toBeVisible();
  const cut = await strip.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(cut).toBeLessThanOrEqual(0);
});
