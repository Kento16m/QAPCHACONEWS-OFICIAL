const SITE = "https://qapchaconews.com";

export const NOINDEX = { name: "robots", content: "noindex" };

export const pageHead = (path: string, title: string, description: string) => {
  const fullTitle = `${title} — QAP ChacoNews`;
  const url = `${SITE}${path}`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
};
