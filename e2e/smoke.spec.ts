// Real browser against a real Supabase project, with temporary data removed at the end.
// Usage: E2E_SUPABASE_URL=... E2E_ANON_KEY=... E2E_SERVICE_KEY=... npm run test:e2e
import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const { E2E_SUPABASE_URL: BASE = "", E2E_ANON_KEY: ANON = "", E2E_SERVICE_KEY: SERVICE = "" } = process.env;

if (!BASE || !ANON || !SERVICE) throw new Error("Set E2E_SUPABASE_URL, E2E_ANON_KEY and E2E_SERVICE_KEY.");
// These tests create and delete data: they must never run against the live site's database.
if (BASE.includes("nkkgwjvmdxggvyzehlzp")) throw new Error("Refusing to run against production.");

const STAMP = Date.now();
const PASSWORD = "Temp-e2e-Pass-92!";
const svcHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

const api = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { ...svcHeaders, ...init.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const email = (name: string) => `e2e-${name}-${STAMP}@test.invalid`;
const userIds: string[] = [];

const makeUser = async (name: string, fullName: string, profile: Record<string, unknown> = {}) => {
  const user = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: email(name), password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  userIds.push(user.id);
  if (Object.keys(profile).length) {
    await api(`/rest/v1/profiles?id=eq.${user.id}`, { method: "PATCH", body: JSON.stringify(profile) });
  }
  return user.id as string;
};

const articleTitle = `E2E Noticia ${STAMP}`;
const articleSlug = `e2e-noticia-${STAMP}`;
let articleId = "";
let commentId = 0;

test.beforeAll(async () => {
  const readerId = await makeUser("reader", "Lectora E2E");
  await makeUser("other", "Otra Persona E2E");
  const editorId = await makeUser("editor", "Editor E2E", { role: "editor" });
  await makeUser("admin", "Admin E2E", { role: "admin" });
  await makeUser("blocked", "Bloqueada E2E", { is_blocked: true, blocked_reason: "Motivo de prueba E2E" });

  const [article] = await api("/rest/v1/articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ title: articleTitle, slug: articleSlug, content: "<p>Cuerpo de la nota.</p>", status: "published", author_id: editorId, is_featured: true }),
  });
  articleId = article.id;
  const comment = await api("/rest/v1/rpc/service_post_comment", {
    method: "POST",
    body: JSON.stringify({ p_user_id: readerId, p_article_id: articleId, p_parent_id: null, p_body: "Comentario existente E2E" }),
  });
  commentId = comment.id;
});

test.afterAll(async () => {
  await api(`/rest/v1/articles?slug=ilike.e2e-*${STAMP}*`, { method: "DELETE" });
  await api(`/rest/v1/newsletter_subscribers?email=ilike.*${STAMP}*`, { method: "DELETE" });
  await api(`/rest/v1/admin_access_logs?email=ilike.e2e-*${STAMP}*`, { method: "DELETE" });
  for (const id of userIds) await api(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
});

const EXTERNAL_DATA = ["**/api/clima*", "**/api/cotizaciones*", "**/cotizaciones.json"];

// Every test runs with weather and exchange-rate services down: the site must not depend on them.
const prepare = async (page: Page | BrowserContext, consent: string | null = "false") => {
  for (const pattern of EXTERNAL_DATA) await page.route(pattern, (route) => route.fulfill({ status: 500, body: "down" }));
  await page.route("**/www.googletagmanager.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  if (consent !== null) {
    await page.addInitScript((value) => window.localStorage.setItem("legal_consent_accepted", value), consent);
  }
};

const login = async (page: Page, name: string) => {
  await page.locator("button:visible", { hasText: "Iniciar sesión" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Correo electrónico").fill(email(name));
  await dialog.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await dialog.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
};

const loginAndWait = async (page: Page, name: string) => {
  await login(page, name);
  await expect(page.getByRole("dialog")).toBeHidden();
};

const openNewArticle = async (page: Page) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Nuevo artículo" }).click();
  await expect(page.getByLabel("Contenido del artículo")).toBeVisible();
};

const titleInput = (page: Page) => page.locator("label", { hasText: "Título" }).locator("input");

test.describe("public site", () => {
  test("home loads with weather and exchange services down", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await prepare(page);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: articleTitle }).first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("an article page shows its author and content", async ({ page }) => {
    await prepare(page);
    await page.goto(`/noticia/${articleSlug}`);
    await expect(page.getByText("Cuerpo de la nota.")).toBeVisible();
    await expect(page.getByText("Editor E2E").first()).toBeVisible();
  });

  for (const term of ["(", ")", ",", "%", '"', "\\", "Chaco (Paraguay), 100%"]) {
    test(`search handles ${JSON.stringify(term)}`, async ({ page }) => {
      let failedSearch = 0;
      page.on("response", (response) => {
        if (response.url().includes("/rest/v1/articles") && response.status() >= 400) failedSearch += 1;
      });
      await prepare(page);

      await page.goto(`/buscar?q=${encodeURIComponent(term)}`);
      await page.waitForLoadState("networkidle");

      expect(failedSearch).toBe(0);
    });
  }

  test("search finds an article by title", async ({ page }) => {
    await prepare(page);
    await page.goto(`/buscar?q=${encodeURIComponent(articleTitle)}`);
    await expect(page.getByRole("heading", { name: articleTitle }).first()).toBeVisible();
  });
});

test.describe("cookies", () => {
  const csp = /Content-Security-Policy = "([^"]+)"/.exec(readFileSync("netlify.toml", "utf8"))?.[1] ?? "";

  // Serves pages with the production CSP; upgrade-insecure-requests would break the local http server.
  const withProductionCsp = async (page: Page) => {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.fallback();
      const response = await route.fetch();
      const headers = { ...response.headers(), "content-security-policy": csp.replace("upgrade-insecure-requests;", "") };
      return route.fulfill({ response, headers });
    });
  };

  test("the production CSP allows the site and GA after accepting", async ({ page }) => {
    expect(csp).toContain("googletagmanager");
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });
    await prepare(page, null);
    await withProductionCsp(page);

    await page.goto("/");
    const banner = page.getByRole("region", { name: "Preferencias de cookies" });
    await expect(banner).toBeVisible();

    const gaRequest = page.waitForRequest((request) => request.url().includes("googletagmanager.com/gtag/js"));
    await banner.getByRole("button", { name: "Aceptar" }).click();
    await gaRequest;
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });

  test("rejecting keeps Google Analytics off across visits", async ({ page }) => {
    let gaRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("googletagmanager.com")) gaRequests += 1;
    });
    await prepare(page, null);

    await page.goto("/");
    await page.getByRole("region", { name: "Preferencias de cookies" }).getByRole("button", { name: "Rechazar" }).click();
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("region", { name: "Preferencias de cookies" })).toBeHidden();
    expect(gaRequests).toBe(0);
  });

  test("the footer reopens the preferences", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Preferencias de cookies" }).click();
    await expect(page.getByRole("region", { name: "Preferencias de cookies" })).toBeVisible();
  });
});

test.describe("accounts", () => {
  test("registering with confirmation pending shows a notice and stays signed out", async ({ page }) => {
    await prepare(page);
    await page.route("**/auth/v1/signup*", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ id: "00000000-0000-0000-0000-0000000000aa", aud: "authenticated", email: email("pending"), user_metadata: {}, app_metadata: {}, created_at: new Date().toISOString() }),
      }),
    );
    await page.goto("/");
    await page.locator("button:visible", { hasText: "Iniciar sesión" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Registrate" }).click();
    await dialog.getByLabel("Nombre completo").fill("Persona Pendiente");
    await dialog.getByLabel("Correo electrónico").fill(email("pending"));
    await dialog.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await dialog.getByLabel("Confirmar contraseña", { exact: true }).fill(PASSWORD);
    await dialog.getByRole("checkbox").click();
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("Te enviamos un correo")).toBeVisible();
    await expect(page.locator("button:visible", { hasText: "Iniciar sesión" }).first()).toBeVisible();
  });

  test("a blocked person sees the reason and stays out", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await login(page, "blocked");
    await expect(page.getByText("Motivo de prueba E2E").first()).toBeVisible();
    await page.reload();
    await expect(page.locator("button:visible", { hasText: "Iniciar sesión" }).first()).toBeVisible();
  });

  test("a reader cannot open the panel", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await loginAndWait(page, "reader");
    await page.goto("/admin");
    await expect(page.getByText("Página no encontrada")).toBeVisible();
    await expect(page.getByText("Centro de trabajo")).toBeHidden();
  });
});

test.describe("comments", () => {
  test("a comment that fails moderation shows why, is not published and keeps the draft", async ({ page }) => {
    await prepare(page);
    await page.goto(`/noticia/${articleSlug}`);
    await loginAndWait(page, "reader");

    const draft = `Comentario sin moderar ${STAMP} 😀🎉`;
    const box = page.getByPlaceholder("Escribí tu comentario...");
    await box.fill(draft);
    await page.locator("button:visible:has(svg.lucide-send)").first().click();

    // No OPENAI_API_KEY in the test project: the function must fail closed.
    await expect(page.getByText("La moderación no está configurada en el servidor.")).toBeVisible();
    // The draft stays in the text boxes to retry, but must not appear as a published comment.
    await expect(page.getByText(draft).and(page.locator(":not(textarea)"))).toHaveCount(0);
    await expect(box).toHaveValue(draft);
    const stored = await api(`/rest/v1/comments?select=id&article_id=eq.${articleId}&body=like.*${STAMP}*`);
    expect(stored).toHaveLength(0);
  });

  test("an emoji-only comment reaches the server", async ({ page }) => {
    await prepare(page);
    let sent: { body?: string; user_id?: string } = {};
    await page.route("**/functions/v1/moderate-comment", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Respuesta de prueba." }) });
    });
    await page.goto(`/noticia/${articleSlug}`);
    await loginAndWait(page, "reader");

    const box = page.getByPlaceholder("Escribí tu comentario...");
    await box.fill("😀🎉");
    await page.locator("button:visible:has(svg.lucide-send)").first().click();

    await expect(page.getByText("Respuesta de prueba.")).toBeVisible();
    expect(sent.body).toBe("😀🎉");
    expect(sent.user_id).toBeUndefined();
  });

  test("a like on someone else's comment survives a reload", async ({ page }) => {
    await prepare(page);
    await page.goto(`/noticia/${articleSlug}`);
    await loginAndWait(page, "other");

    const comment = page.locator("article, li, div").filter({ hasText: "Comentario existente E2E" }).last();
    await expect(comment).toBeVisible();
    await page.locator('button:has(svg.lucide-heart)').first().click();
    await expect.poll(async () => (await api(`/rest/v1/comments?select=like_count&id=eq.${commentId}`))[0].like_count).toBe(1);

    await page.reload();
    await expect(page.locator('button:has(svg.lucide-heart)').first()).toContainText("1");
  });
});

test.describe("editorial panel", () => {
  test("an unsaved article is recovered after a reload and can be discarded", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await loginAndWait(page, "editor");
    await openNewArticle(page);

    await titleInput(page).fill(`Borrador ${STAMP}`);
    await page.getByLabel("Contenido del artículo").fill("Cuerpo recuperable");
    await page.waitForTimeout(1000);
    await page.reload();
    await page.getByRole("button", { name: "Nuevo artículo" }).click();

    await expect(page.getByText("Recuperamos un borrador")).toBeVisible();
    await expect(titleInput(page)).toHaveValue(`Borrador ${STAMP}`);
    await expect(page.getByLabel("Contenido del artículo")).toHaveText("Cuerpo recuperable");

    await page.getByRole("button", { name: "Descartar borrador" }).click();
    await expect(titleInput(page)).toHaveValue("");
    await expect(page.getByLabel("Contenido del artículo")).toHaveText("");
    await expect(page.getByText("Recuperamos un borrador")).toBeHidden();
  });

  test("the article body survives switching tabs in the panel", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await loginAndWait(page, "editor");
    await openNewArticle(page);

    await page.getByLabel("Contenido del artículo").fill("Texto que no se pierde");
    await page.getByRole("button", { name: "Artículos", exact: true }).click();
    await page.getByRole("button", { name: "Crear artículo", exact: true }).first().click();

    await expect(page.getByLabel("Contenido del artículo")).toHaveText("Texto que no se pierde");
    await page.evaluate(() => window.localStorage.removeItem("qap_article_draft:new"));
  });

  test("saving does not remove tags that could not be loaded", async ({ page }) => {
    await prepare(page);
    const [tag] = await api("/rest/v1/tags", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name: `E2E ${STAMP}`, slug: `e2e-${STAMP}` }) });
    await api("/rest/v1/article_tags", { method: "POST", body: JSON.stringify({ article_id: articleId, tag_id: tag.id }) });
    await page.route("**/rest/v1/article_tags?select=tag_id*", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));

    await page.goto("/");
    await loginAndWait(page, "editor");
    await page.goto("/admin");
    await page.getByRole("button", { name: "Artículos", exact: true }).click();
    await page.getByRole("button", { name: articleTitle }).first().click();
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(titleInput(page)).toHaveValue(articleTitle);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    await page.waitForLoadState("networkidle");

    const rows = await api(`/rest/v1/article_tags?select=tag_id&article_id=eq.${articleId}`);
    await api(`/rest/v1/tags?id=eq.${tag.id}`, { method: "DELETE" });
    expect(rows).toHaveLength(1);
  });

  test("the form cannot be edited while saving", async ({ page }) => {
    await prepare(page);
    await page.goto("/");
    await loginAndWait(page, "editor");
    await openNewArticle(page);
    await titleInput(page).fill(`E2E Lenta ${STAMP}`);

    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/rest/v1/articles*", async (route) => {
      if (route.request().method() === "POST") await held;
      await route.fallback();
    });
    await page.getByRole("button", { name: "Publicar artículo" }).click();

    await expect(titleInput(page)).toBeDisabled();
    await expect(page.getByLabel("Contenido del artículo")).toHaveAttribute("contenteditable", "false");

    release();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
    await expect(titleInput(page)).toBeEnabled();
    await expect(page.getByLabel("Contenido del artículo")).toHaveAttribute("contenteditable", "true");
  });

  test("an editor publishes an article that keeps its data through edits", async ({ page, context }) => {
    await prepare(page);
    await page.goto("/");
    await loginAndWait(page, "editor");
    await openNewArticle(page);

    const title = `E2E Publicada ${STAMP}`;
    await titleInput(page).fill(title);
    await page.getByLabel("Contenido del artículo").fill("Texto escrito en el navegador.");
    await page.locator("label", { hasText: "SEO Title" }).locator("input").fill("Título SEO E2E");
    await page.locator("label", { hasText: "Estado" }).locator("select").selectOption("published");
    await page.getByRole("button", { name: "Publicar artículo" }).click();

    // Saving a new article selects it instead of clearing the form.
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
    await expect(titleInput(page)).toHaveValue(title);
    const slug = `e2e-publicada-${STAMP}`;
    const [first] = await api(`/rest/v1/articles?select=published_at,seo_title&slug=eq.${slug}`);
    expect(first.seo_title).toBe("Título SEO E2E");

    await titleInput(page).fill(`${title} editada`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(async () => (await api(`/rest/v1/articles?select=title&slug=eq.${slug}`))[0].title).toBe(`${title} editada`);
    const [edited] = await api(`/rest/v1/articles?select=published_at,seo_title&slug=eq.${slug}`);
    expect(edited.seo_title).toBe("Título SEO E2E");
    expect(edited.published_at).toBe(first.published_at);

    const visitor = await context.browser()!.newContext({ baseURL: "http://127.0.0.1:4179" });
    const visitorPage = await visitor.newPage();
    await prepare(visitorPage);
    await visitorPage.goto(`/buscar?q=${encodeURIComponent(`${title} editada`)}`);
    await expect(visitorPage.getByRole("heading", { name: `${title} editada` }).first()).toBeVisible();
    await visitor.close();
  });

  test("an admin sees the access log and can export it to print", async ({ page, context }) => {
    await prepare(page);
    await page.goto("/");
    await loginAndWait(page, "admin");
    await page.goto("/admin");

    await page.getByRole("button", { name: "Control de Acceso" }).click();
    await expect.poll(async () => (await api(`/rest/v1/admin_access_logs?select=id&email=eq.${email("admin")}`)).length).toBeGreaterThan(0);
    await page.reload();
    await page.getByRole("button", { name: "Control de Acceso" }).click();
    await expect(page.getByText("Admin E2E").first()).toBeVisible();

    const popup = context.waitForEvent("page");
    await page.getByRole("button", { name: /PDF/ }).click();
    await expect((await popup).getByRole("heading", { name: "Control de Acceso" })).toBeVisible();
  });
});
