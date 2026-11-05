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
  await page.getByRole("tab", { name: "Asistente" }).click();

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
  await page.getByRole("tab", { name: "Asistente" }).click();

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
  await page.waitForTimeout(1500);

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

test("an administrator manages roles, blocks, categories and subscribers", async ({ page }) => {
  await makeUser("gestion");
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();

  await page.goto("/usuarios");
  await page.getByRole("searchbox", { name: "Buscar usuarios" }).fill(emailFor("gestion"));
  const person = page.getByRole("row").filter({ hasText: emailFor("gestion") });
  await expect(person).toBeVisible();
  await person.getByRole("combobox").selectOption("editor");
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
  await row.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Nota restaurada como borrador.")).toBeVisible();
  const [note] = await api(`/rest/v1/articles?id=eq.${id}&select=status,content`);
  expect(note.status).toBe("draft");
  expect(note.content).toContain("Texto que vuelve.");

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
