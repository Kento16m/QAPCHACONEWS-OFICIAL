const REMOVE = "script, style, meta, link, title, xml, head";
const KEEP_ATTRIBUTES: Record<string, string[]> = {
  A: ["href"],
  IMG: ["src", "alt"],
};

const unwrap = (element: Element) => element.replaceWith(...element.childNodes);

const wrapChildren = (element: Element, tag: "strong" | "em") => {
  const wrapper = element.ownerDocument.createElement(tag);
  wrapper.append(...element.childNodes);
  element.append(wrapper);
};

const isBoldStyle = (weight: string) => weight === "bold" || Number(weight) >= 600;

/**
 * Word and Google Docs carry their look as styles. Emphasis is kept as real tags and the rest goes,
 * so a pasted text takes the look of the site.
 */
export const cleanPastedHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(REMOVE).forEach((node) => node.remove());

  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((comment) => comment.parentNode?.removeChild(comment));

  for (const element of [...doc.body.querySelectorAll<HTMLElement>("*")]) {
    const { fontWeight, fontStyle } = element.style;
    const plainWrapper = element.tagName === "B" && fontWeight === "normal";

    if (isBoldStyle(fontWeight) && element.tagName !== "B" && element.tagName !== "STRONG") {
      wrapChildren(element, "strong");
    }
    if (fontStyle === "italic" && element.tagName !== "I" && element.tagName !== "EM") {
      wrapChildren(element, "em");
    }

    const keep = KEEP_ATTRIBUTES[element.tagName] ?? [];
    for (const { name } of [...element.attributes]) {
      if (!keep.includes(name)) element.removeAttribute(name);
    }

    // Google Docs wraps the whole paste in <b style="font-weight:normal">, which is not bold at all.
    if (plainWrapper || element.tagName === "SPAN" || element.tagName.includes(":")) {
      unwrap(element);
    }
  }

  return doc.body.innerHTML.trim();
};
