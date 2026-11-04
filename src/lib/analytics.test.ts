import { beforeEach, describe, expect, it, vi } from "vitest";

const ga = vi.hoisted(() => ({ initialize: vi.fn(), send: vi.fn(), event: vi.fn() }));
vi.mock("react-ga4", () => ({ default: ga }));

const TRACKING_ID = "G-TEST";

// analytics keeps module state, like a fresh page load.
const loadPage = async () => {
  vi.resetModules();
  const module = await import("@/lib/analytics");
  module.analytics.initialize(TRACKING_ID);
  return module;
};

beforeEach(() => {
  window.localStorage.clear();
  delete (window as unknown as Record<string, unknown>)[`ga-disable-${TRACKING_ID}`];
  vi.clearAllMocks();
});

describe("analytics consent", () => {
  it("does not load Google Analytics before a decision", async () => {
    const { analytics, getCookieConsent } = await loadPage();

    analytics.pageView("/");
    analytics.event("search", { term: "x" });

    expect(getCookieConsent()).toBeNull();
    expect(ga.initialize).not.toHaveBeenCalled();
    expect(ga.send).not.toHaveBeenCalled();
    expect(ga.event).not.toHaveBeenCalled();
  });

  it("starts as soon as the person accepts", async () => {
    const { analytics, setCookieConsent } = await loadPage();

    setCookieConsent("accepted");

    // The page they are already on counts as the first view.
    expect(ga.initialize).toHaveBeenCalledTimes(1);
    expect(ga.send).toHaveBeenCalledTimes(1);

    analytics.pageView("/nota");
    expect(ga.send).toHaveBeenCalledTimes(2);
  });

  it("remembers acceptance on the next visit", async () => {
    (await loadPage()).setCookieConsent("accepted");
    vi.clearAllMocks();

    const { analytics } = await loadPage();
    analytics.pageView("/");

    expect(ga.initialize).toHaveBeenCalledTimes(1);
    expect(ga.send).toHaveBeenCalledTimes(1);
  });

  it("remembers rejection on the next visit", async () => {
    (await loadPage()).setCookieConsent("rejected");

    const { analytics, getCookieConsent } = await loadPage();
    analytics.pageView("/");

    expect(getCookieConsent()).toBe("rejected");
    expect(ga.initialize).not.toHaveBeenCalled();
    expect(ga.send).not.toHaveBeenCalled();
  });

  it("honors decisions stored by the previous banner", async () => {
    window.localStorage.setItem("legal_consent_accepted", "false");
    const rejected = await loadPage();
    expect(rejected.getCookieConsent()).toBe("rejected");
    expect(ga.initialize).not.toHaveBeenCalled();

    window.localStorage.setItem("legal_consent_accepted", "true");
    const accepted = await loadPage();
    expect(accepted.getCookieConsent()).toBe("accepted");
    expect(ga.initialize).toHaveBeenCalledTimes(1);
  });

  it("stops measuring when the person changes their mind", async () => {
    const { analytics, setCookieConsent } = await loadPage();
    setCookieConsent("accepted");
    vi.clearAllMocks();

    setCookieConsent("rejected");
    analytics.pageView("/");

    expect(ga.send).not.toHaveBeenCalled();
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${TRACKING_ID}`]).toBe(true);
  });

  it("does not initialize twice", async () => {
    const { setCookieConsent } = await loadPage();
    setCookieConsent("accepted");
    setCookieConsent("accepted");
    expect(ga.initialize).toHaveBeenCalledTimes(1);
  });

  it("resumes after rejecting and accepting again", async () => {
    const { analytics, setCookieConsent } = await loadPage();
    setCookieConsent("accepted");
    setCookieConsent("rejected");
    setCookieConsent("accepted");
    vi.clearAllMocks();

    analytics.pageView("/");

    expect(ga.send).toHaveBeenCalledTimes(1);
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${TRACKING_ID}`]).toBe(false);
  });
});
