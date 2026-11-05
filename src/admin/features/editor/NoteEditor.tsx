import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getArticleTagIds, type AdminArticle, type ArticleStatus } from "@/lib/admin";
import { buildArticlePayload, type EditorForm } from "@/lib/article-form";
import { useArticleForm } from "@/hooks/use-article-form";
import { RichEditor } from "../../editor/RichEditor";
import { useCategories } from "../../lib/articles";
import {
  ArticleConflictError,
  breakingUntilFor,
  explainFailedSave,
  fetchArticle,
  prePublishIssues,
  replaceTags,
  saveArticle,
  type Issue,
} from "../../lib/save-article";
import { useSession } from "../../lib/session";
import { StatusBadge } from "../../ui/Field";
import { AiPanel } from "./AiPanel";
import { ConflictDialog } from "./ConflictDialog";
import { History } from "./History";
import { PreviewDialog } from "./PreviewDialog";
import { SidePanel } from "./SidePanel";

const IN_TITLE_LIMIT = 120;

const SAVE_REFUSED = {
  deleted: "Esta nota ya no existe. Tu texto sigue acá: copialo antes de salir.",
  forbidden: "Tu cuenta no puede guardar esta nota. Tu texto sigue acá y en este navegador.",
  unknown: "No pudimos guardar. Tu texto sigue acá y en este navegador: probá de nuevo.",
};

export function NoteEditor({ article }: { article: AdminArticle | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { data: categories } = useCategories();
  const {
    form,
    setForm,
    clearDraft,
    reset,
    recoverDraft,
    hasRestoredDraft,
    hasStaleDraft,
    tagsReady,
    isDirty,
    openedVersion,
    discardStaleDraft,
  } = useArticleForm(article, getArticleTagIds);

  const [saving, setSaving] = useState(false);
  const savingNow = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [conflict, setConflict] = useState<AdminArticle | null>(null);
  const [pendingIssues, setPendingIssues] = useState<Issue[] | null>(null);

  const change = useCallback(
    (changes: Partial<EditorForm>) => setForm((value) => ({ ...value, ...changes })),
    [setForm],
  );
  const setContent = useCallback((content: string) => change({ content }), [change]);

  const save = useCallback(
    async (status: ArticleStatus = form.status, overVersion?: string) => {
      if (!tagsReady) {
        toast.error("Todavía estamos cargando las etiquetas. Probá de nuevo en un momento.");
        return;
      }
      // Only a new note starts with its writer: saving someone else's must not take the byline.
      const author = article ? form.author_id : (form.author_id ?? session?.user.id ?? null);
      const next = { ...form, status, author_id: author };
      let payload;
      try {
        const now = new Date();
        payload = {
          ...buildArticlePayload(next, article, now),
          breaking_until: breakingUntilFor(next.is_breaking, article),
        };
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Revisá los datos de la nota.");
        return;
      }

      if (savingNow.current) return;
      savingNow.current = true;
      setSaving(true);
      try {
        const saved = await saveArticle(
          article?.id ?? null,
          payload,
          overVersion ?? openedVersion(),
        );
        // Only what the save decided: the person may have kept typing while it ran.
        setForm((value) => ({ ...value, status, author_id: next.author_id }));
        clearDraft(saved.updated_at, next);
        queryClient.setQueryData(["admin", "article", saved.id], saved);
        void queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "revisions"] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });

        // The note is already saved here, so a problem with the tags must not look like a failed save.
        try {
          await replaceTags(saved.id, next.tag_ids);
          toast.success(
            status === "published" && form.status !== "published" ? "Nota publicada." : "Guardado.",
          );
        } catch (error) {
          console.error("No se pudieron guardar las etiquetas:", error);
          toast.error("La nota se guardó, pero no las etiquetas. Revisalas y guardá de nuevo.");
        }

        if (!article) {
          void navigate({ to: "/articulos/$id", params: { id: saved.id }, replace: true });
        }
      } catch (error) {
        if (error instanceof ArticleConflictError && article) {
          const version = overVersion ?? openedVersion();
          const latest = await fetchArticle(article.id).catch(() => undefined);
          const reason = explainFailedSave(latest, version);
          if (reason === "conflict") setConflict(latest ?? null);
          else toast.error(SAVE_REFUSED[reason]);
        } else {
          console.error("No se pudo guardar la nota:", error);
          toast.error(
            error instanceof Error && error.message.includes("dirección")
              ? error.message
              : SAVE_REFUSED.unknown,
          );
        }
      } finally {
        savingNow.current = false;
        setSaving(false);
      }
    },
    [
      article,
      clearDraft,
      form,
      navigate,
      openedVersion,
      queryClient,
      session?.user.id,
      setForm,
      tagsReady,
    ],
  );

  const publish = () => {
    const issues = prePublishIssues(form);
    if (issues.length > 0) setPendingIssues(issues);
    else void save("published");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const isPublished = form.status === "published";
  const issues = useMemo(() => prePublishIssues(form), [form]);

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-3 lg:sticky lg:top-16 lg:z-10 lg:-mx-6 lg:border-b lg:bg-background lg:px-6 lg:py-3">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="size-10 rounded-lg"
          aria-label="Volver a Artículos"
        >
          <Link to="/articulos" search={{ page: 1 }}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{article ? "Editar nota" : "Nueva nota"}</h1>
        <StatusBadge status={form.status} />
        <p aria-live="polite" className="text-muted-foreground">
          {saving ? "Guardando…" : isDirty ? "Cambios sin guardar" : article ? "Todo guardado" : ""}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            className="rounded-lg px-4"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-4" aria-hidden />
            Vista previa
          </Button>
          {isPublished ? (
            <Button
              size="lg"
              className="rounded-lg px-4"
              disabled={saving}
              onClick={() => void save()}
            >
              Actualizar
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="lg"
                className="rounded-lg px-4"
                disabled={saving}
                onClick={() => void save()}
              >
                Guardar
              </Button>
              <Button size="lg" className="rounded-lg px-4" disabled={saving} onClick={publish}>
                Publicar
              </Button>
            </>
          )}
        </div>
      </header>

      {hasRestoredDraft && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent px-4 py-3 text-accent-foreground">
          <p>Recuperamos lo que estabas escribiendo y no llegó a guardarse.</p>
          <Button variant="outline" size="sm" className="ml-auto" onClick={reset}>
            Descartar y volver a lo guardado
          </Button>
        </div>
      )}
      {hasStaleDraft && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 text-warning">
          <p>Hay un borrador tuyo de antes de que esta nota cambiara.</p>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={discardStaleDraft}>
              Descartar
            </Button>
            <Button variant="outline" size="sm" onClick={recoverDraft}>
              Recuperar mi borrador
            </Button>
          </div>
        </div>
      )}

      <fieldset disabled={saving && !article} className="grid items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <label className="block">
            <span className="sr-only">Título</span>
            <Textarea
              rows={1}
              value={form.title}
              onChange={(event) => change({ title: event.target.value.replace(/\s*\n\s*/g, " ") })}
              onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
              placeholder="Título de la nota"
              maxLength={IN_TITLE_LIMIT * 2}
              className="min-h-14 resize-none rounded-2xl bg-card px-5 py-3.5 text-xl font-semibold [field-sizing:content] md:text-xl"
            />
          </label>
          <RichEditor
            value={form.content}
            onChange={setContent}
            onEditorReady={setEditor}
            readOnly={saving && !article}
          />
        </div>
        <SidePanel
          isNew={!article}
          form={form}
          onChange={change}
          issues={issues}
          tagsReady={tagsReady}
          extraTabs={[
            {
              id: "asistente",
              label: "Asistente",
              content: <AiPanel form={form} editor={editor} onChange={change} />,
            },
            {
              id: "historial",
              label: "Historial",
              content: (
                <History
                  articleId={article?.id ?? null}
                  form={form}
                  onRestore={(revision) => {
                    const sectionExists = categories?.some(
                      (category) => category.id === revision.category_id,
                    );
                    change({
                      title: revision.title,
                      excerpt: revision.excerpt ?? "",
                      content: revision.content,
                      cover_image_url: revision.cover_image_url ?? "",
                      category_id: sectionExists ? revision.category_id : null,
                      seo_title: revision.seo_title ?? "",
                      seo_description: revision.seo_description ?? "",
                    });
                    toast.success(
                      "Versión cargada en el editor. Revisala y guardá para aplicarla.",
                    );
                  }}
                />
              ),
            },
          ]}
        />
      </fieldset>

      <PreviewDialog form={form} open={previewOpen} onOpenChange={setPreviewOpen} />

      <ConflictDialog
        mine={form}
        theirs={conflict}
        onCancel={() => setConflict(null)}
        onOverwrite={() => {
          const version = conflict?.updated_at;
          setConflict(null);
          if (version) void save(form.status, version);
        }}
        onUseTheirs={() => {
          setConflict(null);
          // The new data reaches the form on the next render, and reset reloads from it.
          queryClient.setQueryData(["admin", "article", article?.id], conflict);
          setTimeout(reset, 0);
        }}
      />

      <AlertDialog
        open={pendingIssues !== null}
        onOpenChange={(open) => !open && setPendingIssues(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Antes de publicar</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="list-disc space-y-1 pl-5">
                {pendingIssues?.map((issue) => (
                  <li key={issue.id}>{issue.message}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingIssues(null);
                void save("published");
              }}
            >
              Publicar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
