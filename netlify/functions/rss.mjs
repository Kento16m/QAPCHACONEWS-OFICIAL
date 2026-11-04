import {
  SITE_URL,
  buildRss,
  feedConfig,
  fetchPublishedArticles,
  xmlResponse,
} from "../shared/site-feeds.mjs";

export default () =>
  xmlResponse("application/rss+xml", async () =>
    buildRss(
      await fetchPublishedArticles("title,slug,excerpt,published_at", feedConfig()),
      SITE_URL,
    ),
  );
