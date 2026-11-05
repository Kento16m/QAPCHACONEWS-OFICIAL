const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

const cell = (value: string | null | undefined) => {
  const text = value ?? "";
  // A spreadsheet would run a value starting with these as a formula.
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (header: string[], rows: (string | null | undefined)[][]) =>
  [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");

export const downloadCsv = (fileName: string, content: string) => {
  // The mark at the start makes Excel read accents correctly.
  const url = URL.createObjectURL(new Blob(["﻿", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
