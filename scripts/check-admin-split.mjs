// Readers must never download panel code, and the panel must ship its server rules.
// Run after building both: npm run build && npm run build:admin
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const PANEL_ONLY_TEXT = ["Requiere atención", "w-\\[264px\\]"];
const HTACCESS_RULES = [
  "RewriteRule",
  "Content-Security-Policy",
  "X-Robots-Tag",
  "Strict-Transport-Security",
];

const filesIn = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesIn(full) : [full];
  });

const failures = [];

for (const file of filesIn("dist").filter((name) => /\.(js|css|html)$/.test(name))) {
  const content = readFileSync(file, "utf8");
  for (const text of PANEL_ONLY_TEXT) {
    if (content.includes(text)) failures.push(`${file} contiene código del panel: ${text}`);
  }
}

const htaccess = path.join("dist-admin", ".htaccess");
if (!existsSync(htaccess)) {
  failures.push("Falta dist-admin/.htaccess");
} else {
  const rules = readFileSync(htaccess, "utf8");
  for (const rule of HTACCESS_RULES) {
    if (!rules.includes(rule)) failures.push(`.htaccess no tiene ${rule}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("El sitio público no contiene código del panel.");
