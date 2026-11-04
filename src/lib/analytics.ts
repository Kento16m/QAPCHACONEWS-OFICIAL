import ReactGA from "react-ga4";

export type AnalyticsEventParams = Record<string, string | number | boolean | undefined | null>;

const safeString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => safeString(item, "")).filter(Boolean).join(",");
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const sanitizeAnalyticsValue = (value: unknown): string | number | boolean | undefined | null => {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAnalyticsValue(item)).filter((item) => item !== undefined && item !== null).join(",");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return safeString(value, "");
    }
  }
  return safeString(value, "") || undefined;
};

const sanitizeAnalyticsParams = (params: Record<string, unknown> = {}) => {
  const sanitized: Record<string, string | number | boolean | undefined | null> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (!key) return;
    const normalized = sanitizeAnalyticsValue(value);
    if (normalized !== undefined) {
      sanitized[key] = normalized;
    }
  });

  return sanitized;
};

export type CookieConsent = "accepted" | "rejected";

const CONSENT_KEY = "legal_consent_accepted";
const CONSENT_OPEN_EVENT = "qap:open-cookie-preferences";

let trackingId = "";
let gaStarted = false;

export const getCookieConsent = (): CookieConsent | null => {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === null) return null;
    return stored === "true" ? "accepted" : "rejected";
  } catch {
    return null;
  }
};

const setGaDisabled = (disabled: boolean) => {
  if (trackingId) (window as unknown as Record<string, unknown>)[`ga-disable-${trackingId}`] = disabled;
};

const isMeasuring = () => gaStarted && getCookieConsent() === "accepted";

const startIfAllowed = () => {
  if (!trackingId || getCookieConsent() !== "accepted") return;
  setGaDisabled(false);
  if (gaStarted) return;

  try {
    ReactGA.initialize(trackingId, {
      gaOptions: {
        send_page_view: false,
      },
    });
    gaStarted = true;
  } catch (error) {
    console.warn("GA init failed:", error);
  }
};

export const setCookieConsent = (consent: CookieConsent) => {
  const wasMeasuring = isMeasuring();
  try {
    window.localStorage.setItem(CONSENT_KEY, String(consent === "accepted"));
  } catch {
    // Without storage the choice is not remembered, and measurement stays off.
  }

  if (consent === "rejected") {
    setGaDisabled(true);
    return;
  }

  startIfAllowed();
  if (!wasMeasuring) analytics.pageView(window.location.pathname, window.location.search);
};

export const reopenCookieConsent = () => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
export const onCookieConsentReopen = (listener: () => void) => {
  window.addEventListener(CONSENT_OPEN_EVENT, listener);
  return () => window.removeEventListener(CONSENT_OPEN_EVENT, listener);
};

export const analytics = {
  initialize: (id: string) => {
    if (!id || typeof window === "undefined") return;
    trackingId = id;
    startIfAllowed();
  },

  pageView: (pathname: string | unknown, search: string | unknown = "", title?: string | unknown) => {
    if (typeof window === "undefined" || !isMeasuring()) return;

    const safePathname = safeString(pathname, window.location.pathname || "/");
    const safeSearch = safeString(search, window.location.search || "");
    const safeTitle = safeString(title, document.title || "QAP ChacoNews") || "QAP ChacoNews";
    const page = `${safePathname}${safeSearch}`;

    try {
      ReactGA.send({
        hitType: "pageview",
        page: String(page || "/"),
        title: String(safeTitle),
      });
    } catch (error) {
      console.warn("GA pageview failed:", error);
    }
  },

  event: (name: string, params: Record<string, unknown> = {}) => {
    if (!isMeasuring()) return;

    try {
      const safeParams = sanitizeAnalyticsParams(params);
      ReactGA.event(name, safeParams);
    } catch (error) {
      console.warn(`GA event '${name}' failed:`, error);
    }
  },

  search: (term: string, source: "desktop" | "mobile" | "results", resultCount = 0) => {
    const normalized = term.trim();
    if (!normalized) return;

    analytics.event("search", {
      search_term: normalized.slice(0, 100),
      source,
      result_count: resultCount,
      has_results: resultCount > 0,
    });
  },

  articleView: (article: {
    id?: string;
    title?: string;
    slug?: string;
    category?: { name?: string | null } | null;
    author?: { full_name?: string | null } | null;
  }) => {
    const title = safeString(article.title, "Artículo");
    analytics.event("article_view", {
      article_id: safeString(article.id, ""),
      article_title: title,
      article_slug: safeString(article.slug, ""),
      article_category: safeString(article.category?.name, "General"),
      article_author: safeString(article.author?.full_name, "Redacción QAP"),
    });
  },

  categoryView: (categoryName: string, source = "category_link") => {
    analytics.event("category_view", {
      category_name: categoryName,
      source,
    });
  },

  articleShare: (platform: string, articleTitle: string, articleSlug?: string) => {
    analytics.event("article_share", {
      platform,
      article_title: articleTitle,
      article_slug: articleSlug ?? "",
    });
  },

  searchResultClick: (term: string, articleTitle: string, position: number, source: "desktop" | "mobile" | "results" = "desktop") => {
    const normalized = term.trim();
    if (!normalized) return;

    analytics.event("search_result_click", {
      search_term: normalized.slice(0, 100),
      result_title: articleTitle,
      position,
      source,
    });
  },

  newsletterSignup: (source: string) => {
    analytics.event("newsletter_signup", {
      source,
      method: "email",
    });
  },

  mobileSearchOpen: () => {
    analytics.event("mobile_search_open", {
      view: "search_overlay",
    });
  },

  authModalOpen: (mode: "login" | "signup") => {
    analytics.event("auth_modal_open", {
      mode,
    });
  },

  articlePublished: (title: string, category?: string | null) => {
    analytics.event("article_published", {
      article_title: title,
      article_category: category ?? "General",
      status: "published",
    });
  },
};

export const trackPageView = analytics.pageView;
export const trackEvent = analytics.event;
export const trackSearch = analytics.search;
export const trackArticleView = analytics.articleView;
export const trackArticleShare = analytics.articleShare;
export const trackSearchResultClick = analytics.searchResultClick;
export const trackNewsletterSignup = analytics.newsletterSignup;
export const trackMobileSearchOpen = analytics.mobileSearchOpen;
export const trackAuthModalOpen = analytics.authModalOpen;
export const trackCategoryView = analytics.categoryView;
export const trackArticlePublished = analytics.articlePublished;
