import { expect, test, type Page } from "@playwright/test";
import { api, makeUser, removeUsers, signIn, STAMP } from "./helpers";

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
  await page.goto(`/articulos/${id}`);
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
