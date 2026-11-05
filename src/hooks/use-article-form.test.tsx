import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArticleForm } from "@/hooks/use-article-form";
import type { AdminArticle } from "@/lib/admin";

const article = (id: string, title = `Nota ${id}`, views = 0, updatedAt = "v1"): AdminArticle => ({
  id,
  title,
  slug: id,
  status: "draft",
  excerpt: null,
  content: "<p>x</p>",
  cover_image_url: null,
  published_at: null,
  scheduled_at: null,
  is_featured: false,
  is_breaking: false,
  breaking_until: null,
  views_count: views,
  category_id: null,
  author_id: "u1",
  seo_title: null,
  seo_description: null,
  updated_at: updatedAt,
  category: null,
  author: null,
});

const loadTags = () => Promise.resolve(["t1"]);

const render = (initial: AdminArticle | null, load: (id: string) => Promise<string[]> = loadTags) =>
  renderHook(({ current }) => useArticleForm(current, load), {
    initialProps: { current: initial },
  });

const type = (result: { current: ReturnType<typeof useArticleForm> }, title: string) =>
  act(() => result.current.setForm((form) => ({ ...form, title })));

const flushDraft = () => act(() => vi.advanceTimersByTime(1000));
const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useArticleForm", () => {
  it("loads the article and its tags", async () => {
    const { result } = render(article("a"));
    await settle();

    expect(result.current.form.title).toBe("Nota a");
    expect(result.current.form.tag_ids).toEqual(["t1"]);
    expect(result.current.hasRestoredDraft).toBe(false);
  });

  it("keeps edits when the list reloads the same article", async () => {
    const { result, rerender } = render(article("a"));
    await settle();
    type(result, "Título editado");

    rerender({ current: article("a", "Nota a", 99) });
    await settle();

    expect(result.current.form.title).toBe("Título editado");
  });

  it("keeps a new article when the list reloads", async () => {
    const { result, rerender } = render(null);
    type(result, "Nota nueva");

    rerender({ current: null });
    await settle();

    expect(result.current.form.title).toBe("Nota nueva");
  });

  it("loads another article when the id changes", async () => {
    const { result, rerender } = render(article("a"));
    await settle();

    rerender({ current: article("b") });
    await settle();

    expect(result.current.form.title).toBe("Nota b");
  });

  it("restores an unsaved new article after a reload", async () => {
    const first = render(null);
    type(first.result, "Texto sin guardar");
    flushDraft();
    first.unmount();

    const { result } = render(null);
    await settle();

    expect(result.current.form.title).toBe("Texto sin guardar");
    expect(result.current.hasRestoredDraft).toBe(true);
  });

  it("restores unsaved edits and keeps drafted tags", async () => {
    const first = render(article("a"));
    await settle();
    act(() =>
      first.result.current.setForm((form) => ({ ...form, title: "Edición", tag_ids: ["t9"] })),
    );
    flushDraft();
    first.unmount();

    const { result } = render(article("a"));
    await settle();

    expect(result.current.form.title).toBe("Edición");
    expect(result.current.form.tag_ids).toEqual(["t9"]);
  });

  it("forgets the draft after a successful save", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Guardado");
    flushDraft();
    act(() => first.result.current.clearDraft());
    flushDraft();
    first.unmount();

    const { result } = render(article("a"));
    await settle();

    expect(result.current.form.title).toBe("Nota a");
    expect(result.current.hasRestoredDraft).toBe(false);
  });

  it("does not store a draft when nothing changed", async () => {
    const { result, unmount } = render(article("a"));
    await settle();
    expect(result.current.form.title).toBe("Nota a");
    flushDraft();
    unmount();

    expect(window.localStorage.getItem("qap_article_draft:a")).toBeNull();
  });

  it("discards a restored draft on reset", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Descartable");
    flushDraft();
    first.unmount();

    const { result } = render(article("a"));
    await settle();
    await act(async () => {
      result.current.reset();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.form.title).toBe("Nota a");
    expect(result.current.hasRestoredDraft).toBe(false);
    expect(window.localStorage.getItem("qap_article_draft:a")).toBeNull();
  });

  it("is ready to save tags for a new article", () => {
    expect(render(null).result.current.tagsReady).toBe(true);
  });

  it("is not ready to save tags until they arrive", async () => {
    const { result } = render(article("a"));
    expect(result.current.tagsReady).toBe(false);
    await settle();
    expect(result.current.tagsReady).toBe(true);
  });

  it("never reports tags as ready when they failed to load", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = render(article("a"), () => Promise.reject(new Error("down")));
    await settle();
    expect(result.current.tagsReady).toBe(false);
    consoleError.mockRestore();
  });

  it("does not store an empty tag list typed before tags arrive", async () => {
    const first = render(article("a"), () => new Promise(() => {}));
    type(first.result, "Rápida");
    flushDraft();
    first.unmount();

    const { result } = render(article("a"));
    await settle();

    expect(result.current.form.title).toBe("Rápida");
    expect(result.current.form.tag_ids).toEqual(["t1"]);
    expect(result.current.tagsReady).toBe(true);
  });

  it("does not let an old draft replace a newer version", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Borrador viejo");
    flushDraft();
    first.unmount();

    const { result } = render(article("a", "Versión nueva", 0, "v2"));
    await settle();
    flushDraft();

    expect(result.current.form.title).toBe("Versión nueva");
    expect(result.current.hasStaleDraft).toBe(true);
    expect(result.current.hasRestoredDraft).toBe(false);
    expect(window.localStorage.getItem("qap_article_draft:a")).not.toBeNull();
  });

  it("recovers an old draft only when asked", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Borrador viejo");
    flushDraft();
    first.unmount();

    const { result } = render(article("a", "Versión nueva", 0, "v2"));
    await settle();
    act(() => result.current.recoverDraft());

    expect(result.current.form.title).toBe("Borrador viejo");
    expect(result.current.hasStaleDraft).toBe(false);
    expect(result.current.hasRestoredDraft).toBe(true);
  });

  it("does not lose an old draft when the person starts typing", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Borrador viejo");
    flushDraft();
    first.unmount();

    const { result, unmount } = render(article("a", "Versión nueva", 0, "v2"));
    await settle();
    type(result, "Tecla nueva");
    flushDraft();
    expect(result.current.hasStaleDraft).toBe(true);
    unmount();

    const again = render(article("a", "Versión nueva", 0, "v2"));
    await settle();
    expect(again.result.current.hasStaleDraft).toBe(true);
    act(() => again.result.current.recoverDraft());
    expect(again.result.current.form.title).toBe("Borrador viejo");
  });

  it("keeps an old draft after saving, until the person decides", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Borrador viejo");
    flushDraft();
    first.unmount();

    const { result, unmount } = render(article("a", "Versión nueva", 0, "v2"));
    await settle();
    act(() => result.current.clearDraft("v3"));
    unmount();

    const again = render(article("a", "Versión nueva", 0, "v3"));
    await settle();
    expect(again.result.current.hasStaleDraft).toBe(true);
    act(() => again.result.current.discardStaleDraft());
    expect(again.result.current.hasStaleDraft).toBe(false);
    again.unmount();

    const last = render(article("a", "Versión nueva", 0, "v3"));
    await settle();
    expect(last.result.current.hasStaleDraft).toBe(false);
  });

  it("gives the version opened, which a later refresh of the data does not change", async () => {
    const { result, rerender } = render(article("a", "Nota", 0, "v1"));
    await settle();
    rerender({ current: article("a", "Nota", 0, "v2") });
    expect(result.current.openedVersion()).toBe("v1");
    act(() => result.current.clearDraft("v3"));
    expect(result.current.openedVersion()).toBe("v3");
  });

  it("keeps what was typed while a save was running", async () => {
    const { result } = render(article("a"));
    await settle();
    type(result, "Lo guardado");
    const saved = result.current.form;
    type(result, "Lo guardado y más");
    act(() => result.current.clearDraft("v2", saved));
    flushDraft();

    expect(result.current.form.title).toBe("Lo guardado y más");
    expect(result.current.isDirty).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem("qap_article_draft:a") ?? "{}");
    expect(stored.form.title).toBe("Lo guardado y más");
    expect(stored.version).toBe("v2");
  });

  it("is clean right after saving when nothing else was typed", async () => {
    const { result } = render(article("a"));
    await settle();
    const next = { ...result.current.form, status: "published" as const };
    act(() => {
      result.current.setForm(next);
      result.current.clearDraft("v2", next);
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("discards an old draft on reset", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Borrador viejo");
    flushDraft();
    first.unmount();

    const { result } = render(article("a", "Versión nueva", 0, "v2"));
    await settle();
    await act(async () => {
      result.current.reset();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.hasStaleDraft).toBe(false);
    expect(window.localStorage.getItem("qap_article_draft:a")).toBeNull();
  });

  it("treats edits after a save as based on the saved version", async () => {
    const first = render(article("a"));
    await settle();
    type(first.result, "Guardado");
    act(() => first.result.current.clearDraft("v2"));
    type(first.result, "Después de guardar");
    flushDraft();
    first.unmount();

    const { result } = render(article("a", "Guardado", 0, "v2"));
    await settle();

    expect(result.current.form.title).toBe("Después de guardar");
    expect(result.current.hasRestoredDraft).toBe(true);
    expect(result.current.hasStaleDraft).toBe(false);
  });

  it("works when localStorage is unavailable", async () => {
    const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = render(null);
    type(result, "Sin almacenamiento");
    flushDraft();

    expect(spy).toHaveBeenCalled();
    expect(result.current.form.title).toBe("Sin almacenamiento");
    spy.mockRestore();
  });
});
