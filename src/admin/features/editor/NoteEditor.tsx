import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { getArticleTagIds, type AdminArticle, type ArticleStatus } from "@/lib/admin";
import { buildArticlePayload, type EditorForm } from "@/lib/article-form";
import { useArticleForm } from "@/hooks/use-article-form";
import { RichEditor } from "../../editor/RichEditor";
import {
  ArticleConflictError,
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

export function NoteEditor({ article }: { article: AdminArticle | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
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
  } = useArticleForm(article, getArticleTagIds);

  const [saving, setSaving] = useState(false);
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
      const next = { ...form, status, author_id: form.author_id ?? session?.user.id ?? null };
      let payload;
      try {
        payload = buildArticlePayload(next, article, new Date());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Revisá los datos de la nota.");
        return;
      }

      setSaving(true);
      try {
        const saved = await saveArticle(
          article?.id ?? null,
          payload,
          overVersion ?? article?.updated_at ?? null,
        );
        await replaceTags(saved.id, next.tag_ids);
        setForm(next);
        clearDraft(saved.updated_at);
        queryClient.setQueryData(["admin", "article", saved.id], saved);
        void queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "revisions"] });
        void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        toast.success(
          status === "published" && form.status !== "published" ? "Nota publicada." : "Guardado.",
        );
        if (!article) {
          void navigate({ to: "/articulos/$id", params: { id: saved.id }, replace: true });
        }
      } catch (error) {
        if (error instanceof ArticleConflictError && article) {
          setConflict(await fetchArticle(article.id));
        } else {
          console.error("No se pudo guardar la nota:", error);
          toast.error(
            error instanceof Error && error.message.includes("dirección")
              ? error.message
              : "No pudimos guardar. Tu texto sigue acá y en este navegador: probá de nuevo.",
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [article, clearDraft, form, navigate, queryClient, session?.user.id, setForm, tagsReady],
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
      <header className="mb-4 flex flex-wrap items-center gap-3">
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
          <Button variant="outline" size="sm" className="ml-auto" onClick={recoverDraft}>
            Recuperar mi borrador
          </Button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <label className="block">
            <span className="sr-only">Título</span>
            <Input
              value={form.title}
              onChange={(event) => change({ title: event.target.value })}
              placeholder="Título de la nota"
              maxLength={IN_TITLE_LIMIT * 2}
              className="h-14 rounded-2xl bg-card px-5 text-xl font-semibold md:text-xl"
            />
          </label>
          <RichEditor value={form.content} onChange={setContent} onEditorReady={setEditor} />
        </div>
        <SidePanel
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
                    change({
                      title: revision.title,
                      excerpt: revision.excerpt ?? "",
                      content: revision.content,
                      cover_image_url: revision.cover_image_url ?? "",
                      category_id: revision.category_id,
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
      </div>

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
          void queryClient
            .invalidateQueries({ queryKey: ["admin", "article", article?.id] })
            .then(reset);
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
