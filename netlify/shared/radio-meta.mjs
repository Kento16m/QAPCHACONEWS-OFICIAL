import { replaceHead } from "./article-meta.mjs";

// Social networks do not run JavaScript, so the route's own tags must be in the HTML too.
const TITLE = "Radio en vivo — QAP ChacoNews";
const DESCRIPTION = "Escuchá la radio de QAP ChacoNews en vivo, desde el Chaco paraguayo.";
const SITE = "https://qapchaconews.com";

const HEAD = [
  `<title>${TITLE}</title>`,
  `<link rel="canonical" href="${SITE}/radio" />`,
  // The largest element of the page: fetch it without waiting for the JavaScript.
  `<link rel="preload" as="image" href="/radio-cover.webp" type="image/webp" fetchpriority="high" />`,
  `<meta name="description" content="${DESCRIPTION}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="QAP ChacoNews" />`,
  `<meta property="og:title" content="${TITLE}" />`,
  `<meta property="og:description" content="${DESCRIPTION}" />`,
  `<meta property="og:url" content="${SITE}/radio" />`,
  `<meta property="og:image" content="${SITE}/radio-cover.png" />`,
  `<meta name="twitter:card" content="summary" />`,
  `<meta name="twitter:title" content="${TITLE}" />`,
  `<meta name="twitter:description" content="${DESCRIPTION}" />`,
  `<meta name="twitter:image" content="${SITE}/radio-cover.png" />`,
].join("\n    ");

export const handleRadioRequest = async (next) => {
  const response = await next();
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  return new Response(replaceHead(await response.text(), HEAD), {
    status: response.status,
    headers,
  });
};
