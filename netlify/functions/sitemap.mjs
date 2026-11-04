import {
  SITE_URL,
  buildSitemap,
  feedConfig,
  fetchAllRows,
  fetchPublishedArticles,
  xmlResponse,
} from "../shared/site-feeds.mjs";

export default () =>
  xmlResponse("application/xml", async () => {
    const config = feedConfig();
    const [articles, categories, tags] = await Promise.all([
      fetchPublishedArticles("slug,published_at,updated_at", config),
      fetchAllRows("categories?select=slug&order=sort_order", config),
      fetchAllRows("tags?select=slug&order=slug", config),
    ]);
    return buildSitemap({ articles, categories, tags }, SITE_URL);
  });
