import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { assertTestTarget } from "../../scripts/lib/test-target.mjs";

const {
  E2E_SUPABASE_URL: BASE = "",
  E2E_ANON_KEY: ANON = "",
  E2E_SERVICE_KEY: SERVICE = "",
} = process.env;

if (!BASE || !ANON || !SERVICE)
  throw new Error("Set E2E_SUPABASE_URL, E2E_ANON_KEY and E2E_SERVICE_KEY.");
assertTestTarget(BASE);

export const PASSWORD = "Temp-e2e-Pass-92!";
export const STAMP = Date.now();

export const api = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const userIds: string[] = [];

export const emailFor = (name: string) => `e2e-${name}-${STAMP}@test.invalid`;

export const makeUser = async (name: string, profile: Record<string, unknown> = {}) => {
  const user = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: emailFor(name),
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: `${name} E2E` },
    }),
  });
  userIds.push(user.id);
  if (Object.keys(profile).length) {
    await api(`/rest/v1/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify(profile),
    });
  }
  return user.id as string;
};

export const removeUsers = async () => {
  await api(`/rest/v1/admin_access_logs?email=like.e2e-*`, { method: "DELETE" });
  for (const id of userIds.splice(0)) {
    await api(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
  }
};

export const signIn = async (page: Page, name: string) => {
  await page.goto("/");
  await page.getByLabel("Correo").fill(emailFor(name));
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
};

export const signOut = async (page: Page) => {
  await page.getByRole("button", { name: /E2E/ }).click();
  await page.getByRole("menuitem", { name: "Salir" }).click();
  await expect(page.getByRole("heading", { name: "Entrá al panel" })).toBeVisible();
};

const fromBase32 = (input: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input.replace(/=+$/, ""))
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
};

/** The code an authenticator app would show (RFC 6238). */
export const totp = (secret: string, now = Date.now()) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hash = createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
};
