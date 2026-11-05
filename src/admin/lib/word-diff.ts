export type DiffPart = { type: "same" | "add" | "del"; text: string };

// Past this many changed words a side by side reading is clearer than a word-by-word one.
const MAX_MIDDLE_WORDS = 3000;

const tokens = (text: string) => text.match(/\s+|[^\s]+/g) ?? [];

const push = (parts: DiffPart[], type: DiffPart["type"], text: string) => {
  if (!text) return;
  const last = parts.at(-1);
  if (last?.type === type) last.text += text;
  else parts.push({ type, text });
};

/** Longest common subsequence over the part that differs. */
const middleDiff = (a: string[], b: string[], parts: DiffPart[]) => {
  if (a.length > MAX_MIDDLE_WORDS || b.length > MAX_MIDDLE_WORDS) {
    push(parts, "del", a.join(""));
    push(parts, "add", b.join(""));
    return;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + j + 1]! + 1
          : Math.max(table[(i + 1) * cols + j]!, table[i * cols + j + 1]!);
    }
  }

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(parts, "same", a[i]!);
      i++;
      j++;
    } else if (table[(i + 1) * cols + j]! >= table[i * cols + j + 1]!) {
      push(parts, "del", a[i++]!);
    } else {
      push(parts, "add", b[j++]!);
    }
  }
  push(parts, "del", a.slice(i).join(""));
  push(parts, "add", b.slice(j).join(""));
};

export const wordDiff = (before: string, after: string): DiffPart[] => {
  const a = tokens(before);
  const b = tokens(after);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const parts: DiffPart[] = [];
  push(parts, "same", a.slice(0, start).join(""));
  middleDiff(a.slice(start, endA), b.slice(start, endB), parts);
  push(parts, "same", a.slice(endA).join(""));
  return parts;
};

const BLOCKS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "TR", "DIV"]);

/** A note as plain lines, for comparing versions. Media gets a name so changes to it show too. */
export const htmlToText = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  let line = "";
  const flush = () => {
    if (line.trim()) lines.push(line.trim());
    line = "";
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      line += node.textContent ?? "";
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === "IMG") {
      flush();
      lines.push(`[Imagen: ${node.getAttribute("alt") || "sin descripción"}]`);
      return;
    }
    if (node.tagName === "IFRAME" || node.tagName === "VIDEO") {
      flush();
      lines.push("[Video]");
      return;
    }
    const isBlock = BLOCKS.has(node.tagName);
    if (isBlock) flush();
    node.childNodes.forEach(walk);
    if (isBlock || node.tagName === "BR") flush();
  };

  doc.body.childNodes.forEach(walk);
  flush();
  return lines.join("\n");
};
