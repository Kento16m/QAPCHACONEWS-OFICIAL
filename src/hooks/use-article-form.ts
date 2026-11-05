import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminArticle } from "@/lib/admin";
import { emptyForm, type EditorForm, formFromArticle } from "@/lib/article-form";

const DRAFT_DELAY_MS = 800;
const draftKey = (key: string) => `qap_article_draft:${key}`;

// `version` is the article's updated_at when editing began, to detect a newer save by someone else.
type StoredDraft = { form: Partial<EditorForm>; version: string | null };

// shortcut: drafts live per browser, not per user; scope them by user id if editors share a computer.
const readDraft = (key: string): StoredDraft | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(key));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.form ? parsed : null;
  } catch {
    return null;
  }
};

const writeDraft = (key: string, draft: StoredDraft) => {
  try {
    window.localStorage.setItem(draftKey(key), JSON.stringify(draft));
  } catch {
    // Full or blocked storage only costs the draft; the form itself keeps working.
  }
};

const removeDraft = (key: string) => {
  try {
    window.localStorage.removeItem(draftKey(key));
  } catch {
    // Nothing to clean if storage is blocked.
  }
};

// The author is filled in automatically, so on its own it does not count as an edit.
const contentOf = ({ author_id: _author, ...rest }: EditorForm) => JSON.stringify(rest);

export function useArticleForm(
  article: AdminArticle | null,
  loadTagIds: (articleId: string) => Promise<string[]>,
) {
  const key = article?.id ?? "new";
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [hasStaleDraft, setHasStaleDraft] = useState(false);
  // False until the real tags are known: saving replaces all tags, so an unknown list must not be saved.
  const [tagsReady, setTagsReady] = useState(article === null);
  const [reloads, setReloads] = useState(0);

  const baseline = useRef(emptyForm());
  const version = useRef<string | null>(null);
  const staleDraft = useRef<StoredDraft | null>(null);
  const tagsKnown = useRef(article === null);
  const latest = useRef({ article, loadTagIds, form });
  latest.current = { article, loadTagIds, form };
  const pendingDraft = useRef<number | undefined>(undefined);

  const markTagsReady = (ready: boolean) => {
    tagsKnown.current = ready;
    setTagsReady(ready);
  };

  // Only a different article reloads the form: a list refresh must never touch what is being typed.
  useEffect(() => {
    const current = latest.current.article;
    const draft = readDraft(key);
    version.current = current?.updated_at ?? null;
    const isStale = Boolean(draft && draft.version !== version.current);
    const usable = isStale ? null : draft;

    baseline.current = current ? formFromArticle(current, []) : emptyForm();
    staleDraft.current = isStale ? draft : null;
    setHasStaleDraft(isStale);
    setHasRestoredDraft(Boolean(usable));
    setForm({ ...baseline.current, ...usable?.form });

    const draftHasTags = usable?.form.tag_ids !== undefined;
    markTagsReady(!current || draftHasTags);
    if (!current) return;

    let cancelled = false;
    latest.current
      .loadTagIds(current.id)
      .then((tagIds) => {
        if (cancelled) return;
        baseline.current = { ...baseline.current, tag_ids: tagIds };
        if (!draftHasTags) setForm((value) => ({ ...value, tag_ids: tagIds }));
        markTagsReady(true);
      })
      .catch((error) => {
        console.error("No se pudieron cargar las etiquetas del artículo.", error);
      });

    return () => {
      cancelled = true;
    };
  }, [key, reloads]);

  useEffect(() => {
    if (contentOf(form) === contentOf(baseline.current)) {
      // An older draft waits for the editor's decision.
      if (!staleDraft.current) removeDraft(key);
      return;
    }

    pendingDraft.current = window.setTimeout(() => {
      const { tag_ids, ...withoutTags } = form;
      writeDraft(key, {
        form: tagsKnown.current ? { ...withoutTags, tag_ids } : withoutTags,
        version: version.current,
      });
      staleDraft.current = null;
      setHasStaleDraft(false);
    }, DRAFT_DELAY_MS);
    return () => window.clearTimeout(pendingDraft.current);
  }, [form, key]);

  // After a save, what is on screen is the new reference point.
  const clearDraft = useCallback(
    (savedVersion?: string) => {
      window.clearTimeout(pendingDraft.current);
      baseline.current = latest.current.form;
      if (savedVersion) version.current = savedVersion;
      staleDraft.current = null;
      removeDraft(key);
      setHasRestoredDraft(false);
      setHasStaleDraft(false);
    },
    [key],
  );

  const reset = useCallback(() => {
    window.clearTimeout(pendingDraft.current);
    staleDraft.current = null;
    removeDraft(key);
    setReloads((value) => value + 1);
  }, [key]);

  const recoverDraft = useCallback(() => {
    const draft = staleDraft.current;
    if (!draft) return;
    staleDraft.current = null;
    setForm((value) => ({ ...value, ...draft.form }));
    if (draft.form.tag_ids !== undefined) {
      tagsKnown.current = true;
      setTagsReady(true);
    }
    setHasStaleDraft(false);
    setHasRestoredDraft(true);
  }, []);

  return {
    form,
    setForm,
    clearDraft,
    reset,
    recoverDraft,
    hasRestoredDraft,
    hasStaleDraft,
    tagsReady,
    isDirty: contentOf(form) !== contentOf(baseline.current),
  };
}
