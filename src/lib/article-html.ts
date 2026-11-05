import DOMPurify from "dompurify";

export function normalizeArticleContent(html: string) {
  const trimmed = html.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(normalized);
  const blockTagPattern =
    /<\/?(?:p|div|h[1-6]|ul|ol|li|blockquote|figure|table|pre|section|article|iframe|img|video)\b/i;

  const wrapInlineText = (value: string) => {
    const cleanValue = value.trim();
    if (!cleanValue) return "";

    const lines = cleanValue
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      return lines.map((line) => `<p>${line}</p>`).join("");
    }

    return `<p>${cleanValue}</p>`;
  };

  if (!looksLikeHtml) {
    return normalized
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => wrapInlineText(block))
      .join("");
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return "";

  return blocks
    .map((block) => {
      if (!blockTagPattern.test(block)) {
        return wrapInlineText(block);
      }

      const parts = block.split(
        /(<\/?(?:figure|iframe|video|img|div|p|h[1-6]|ul|ol|li|blockquote|table|pre|section|article)\b[^>]*>[\s\S]*?<\/?(?:figure|iframe|video|img|div|p|h[1-6]|ul|ol|li|blockquote|table|pre|section|article)>)/i,
      );

      if (parts.length <= 1) {
        return block;
      }

      return parts
        .map((part) => {
          if (!part) return "";
          if (
            /^<\/?(?:figure|iframe|video|img|div|p|h[1-6]|ul|ol|li|blockquote|table|pre|section|article)\b/i.test(
              part,
            )
          ) {
            return part;
          }
          return wrapInlineText(part);
        })
        .join("");
    })
    .join("");
}

function stripAdminMediaControls(html: string) {
  if (!html) return "";

  const baseClean = html.replace(/<button\b[^>]*data-remove-media[^>]*>.*?<\/button>/gis, "");
  if (typeof DOMParser === "undefined") return baseClean;

  const doc = new DOMParser().parseFromString(baseClean, "text/html");
  doc.querySelectorAll("[data-remove-media]").forEach((node) => node.remove());
  doc
    .querySelectorAll("[contenteditable='false']")
    .forEach((node) => node.removeAttribute("contenteditable"));
  doc.querySelectorAll("[data-media-block='true']").forEach((node) => {
    const element = node as HTMLElement;
    if (element.tagName.toLowerCase() === "button") {
      element.remove();
    }
  });

  return doc.body.innerHTML;
}

/** Turns a stored note into the HTML a reader sees. Used by the site and the panel's preview. */
export function prepareArticleHtml(html: string) {
  const normalized = stripAdminMediaControls(normalizeArticleContent(html));
  return DOMPurify.sanitize(normalized, {
    ADD_TAGS: ["iframe", "figure", "figcaption", "video"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "loading",
      "referrerpolicy",
      "playsinline",
      "webkitallowfullscreen",
      "mozallowfullscreen",
    ],
    // A note is only text and media: nothing in it may collect data or restyle the page.
    FORBID_TAGS: ["form", "input", "textarea", "select", "style"],
  });
}
