import { expect, test } from "@playwright/test";
import { makeUser, removeUsers, signIn, signOut, totp } from "./helpers";

test.beforeAll(async () => {
  await makeUser("reader");
  await makeUser("editor", { role: "editor" });
  await makeUser("admin", { role: "admin" });
  await makeUser("blocked", { role: "editor", is_blocked: true, blocked_reason: "Motivo E2E" });
});

test.afterAll(removeUsers);

test("a wrong password explains itself", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Correo").fill("nadie@test.invalid");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Correo o contraseña incorrectos.");
});

test("a reader has no access", async ({ page }) => {
  await signIn(page, "reader");
  await expect(page.getByRole("heading", { name: "No tenés acceso al panel" })).toBeVisible();
});

test("a blocked account sees why", async ({ page }) => {
  await signIn(page, "blocked");
  await expect(page.getByRole("heading", { name: "Tu cuenta está bloqueada" })).toBeVisible();
  await expect(page.getByText("Motivo E2E")).toBeVisible();
});

test("an editor enters and does not see administration", async ({ page }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Requiere atención" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByText("Artículos")).toBeVisible();
  await expect(nav.getByText("Usuarios")).toHaveCount(0);
});

test("the theme choice survives a reload", async ({ page }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar a modo oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Cambiar a modo claro" })).toBeVisible();
});

test("an admin registers a device and must give the code next time", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page.getByText("Pronto vas a necesitar un código")).toBeVisible();
  await page.getByRole("link", { name: "Activar ahora" }).click();
  await page.getByRole("button", { name: "Registrar un dispositivo" }).click();

  const secret = (await page.getByTestId("totp-secret").textContent()) ?? "";
  await page.getByLabel("Código de 6 dígitos").fill("000000");
  await page.getByRole("button", { name: "Registrar dispositivo" }).click();
  await expect(page.getByRole("alert")).toContainText("no es correcto");

  await page.getByLabel("Código de 6 dígitos").fill(totp(secret));
  await page.getByRole("button", { name: "Registrar dispositivo" }).click();
  await expect(page.getByText("Dispositivo 1")).toBeVisible();
  await expect(page.getByText("Registrá un segundo dispositivo")).toBeVisible();

  await signOut(page);
  await signIn(page, "admin");
  await expect(page.getByRole("heading", { name: "Confirmá que sos vos" })).toBeVisible();
  await page.getByLabel("Código de 6 dígitos").fill(totp(secret));
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Hoy" })).toBeVisible();
});
