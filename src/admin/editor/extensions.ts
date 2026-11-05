import { generateHTML, generateJSON, mergeAttributes, Node, type Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";

// Same sites the public site's CSP lets play inside a note.
const EMBED_HOSTS = /^(www\.)?(youtube\.com|youtube-nocookie\.com|instagram\.com)$/;

export const isAllowedEmbed = (src: string | null) => {
  if (!src) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && EMBED_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
};

const copyAttributes = (names: string[]) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute(name),
      },
    ]),
  );

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () =>
    copyAttributes([
      "src",
      "title",
      "class",
      "loading",
      "allow",
      "allowfullscreen",
      "referrerpolicy",
    ]),
  parseHTML: () => [
    {
      tag: "iframe",
      getAttrs: (element) => (isAllowedEmbed(element.getAttribute("src")) ? null : false),
    },
  ],
  renderHTML: ({ HTMLAttributes }) => ["iframe", mergeAttributes(HTMLAttributes)],
});

export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => copyAttributes(["src", "poster", "class", "controls", "playsinline"]),
  parseHTML: () => [{ tag: "video[src]" }],
  renderHTML: ({ HTMLAttributes }) => ["video", mergeAttributes(HTMLAttributes)],
});

export const extensions: Extensions = [
  StarterKit.configure({
    link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: null } },
  }),
  Image.configure({ allowBase64: false }),
  TableKit,
  Embed,
  Video,
];

/** The old panel left its own buttons inside some notes. The media stays, the buttons go. */
export const removeOldControls = (html: string) => {
  if (!html.includes("data-remove-media")) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("[data-remove-media]").forEach((node) => node.remove());
  return doc.body.innerHTML;
};

export const roundtrip = (html: string) =>
  generateHTML(generateJSON(removeOldControls(html), extensions), extensions);

/** What to embed for a link someone pastes from YouTube or Instagram, or null if it is neither. */
export const embedUrlFor = (link: string): string | null => {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (!EMBED_HOSTS.test(url.hostname) && url.hostname !== "youtu.be") return null;

  if (url.hostname === "youtu.be") {
    return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
  }
  if (url.hostname.includes("youtube")) {
    const id =
      url.searchParams.get("v") ?? url.pathname.match(/\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  const post = url.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
  return post ? `https://www.instagram.com/${post[1]}/${post[2]}/embed/` : null;
};
