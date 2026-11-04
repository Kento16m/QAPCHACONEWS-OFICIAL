// Runs supabase/tests/security.sql against a project. The SQL always ends by raising
// its report, so the transaction rolls back and the database keeps no test data.
// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... npm run test:db
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF.");
  process.exit(2);
}

const query = readFileSync(new URL("../supabase/tests/security.sql", import.meta.url), "utf8");
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const body = await response.text();

const report = body.replace(/\\n/g, "\n").match(/QC_TEST_REPORT total=(\d+) failed=(\d+)([\s\S]*)/);
if (!report) {
  console.error(`The tests did not finish (HTTP ${response.status}):\n${body.slice(0, 2000)}`);
  process.exit(2);
}

const [, total, failed, detail] = report;
const failures = detail.split("\n").filter((line) => line.includes(" => got "));
failures.forEach((line) => console.error(`FAIL ${line.replace(/\\"/g, '"')}`));
console.log(`${Number(total) - Number(failed)}/${total} passed`);
process.exit(Number(failed) === 0 ? 0 : 1);
