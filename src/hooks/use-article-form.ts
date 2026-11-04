import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminArticle } from "@/lib/admin";
import { emptyForm, type EditorForm, formFromArticle } from "@/lib/article-form";

const DRAFT_DELAY_MS = 800;
const draftKey = (key: string) => `qap_article_draft:${key}`;

// shortcut: drafts live per browser, not per user; scope them by user id if editors share a computer.
const readDraft = (key: string): EditorForm | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(key));
    return raw ? { ...emptyForm(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
};

const writeDraft = (key: string, form: EditorForm) => {
  try {
    window.localStorage.setItem(draftKey(key), JSON.stringify(form));
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

export function useArticleForm(article: AdminArticle | null, loadTagIds: (articleId: string) => Promise<string[]>) {
  const key = article?.id ?? "new";
  const [form, setForm] = useState<EditorForm>(emptyForm);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [reloads, setReloads] = useState(0);

  const baseline = useRef(emptyForm());
  const latest = useRef({ article, loadTagIds, form });
  latest.current = { article, loadTagIds, form };
  const pendingDraft = useRef<number | undefined>(undefined);

  // Only a different article reloads the form: a list refresh must never touch what is being typed.
  useEffect(() => {
    const current = latest.current.article;
    const draft = readDraft(key);
    baseline.current = current ? formFromArticle(current, []) : emptyForm();
    setHasRestoredDraft(Boolean(draft));
    setForm(draft ?? baseline.current);
    if (!current) return;

    let cancelled = false;
    latest.current
      .loadTagIds(current.id)
      .catch((error) => {
        console.error("No se pudieron cargar las etiquetas del artículo.", error);
        return [] as string[];
      })
      .then((tagIds) => {
        if (cancelled) return;
        baseline.current = { ...baseline.current, tag_ids: tagIds };
        if (!draft) setForm((value) => ({ ...value, tag_ids: tagIds }));
      });

    return () => {
      cancelled = true;
    };
  }, [key, reloads]);

  useEffect(() => {
    if (contentOf(form) === contentOf(baseline.current)) {
      removeDraft(key);
      return;
    }
    pendingDraft.current = window.setTimeout(() => writeDraft(key, form), DRAFT_DELAY_MS);
    return () => window.clearTimeout(pendingDraft.current);
  }, [form, key]);

  // After a save, what is on screen is the new reference point.
  const clearDraft = useCallback(() => {
    window.clearTimeout(pendingDraft.current);
    baseline.current = latest.current.form;
    removeDraft(key);
    setHasRestoredDraft(false);
  }, [key]);

  const reset = useCallback(() => {
    window.clearTimeout(pendingDraft.current);
    removeDraft(key);
    setReloads((value) => value + 1);
  }, [key]);

  return { form, setForm, clearDraft, reset, hasRestoredDraft };
}
