import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EditorForm } from "@/lib/article-form";
import { requireSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { htmlToText, wordDiff } from "../../lib/word-diff";
import { Skeleton } from "../../ui/Field";

export type Revision = {
  id: number;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  category_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  editor: { full_name: string | null } | null;
};

const when = new Intl.DateTimeFormat("es-PY", {
  timeZone: "America/Asuncion",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const fetchRevisions = async (articleId: string) => {
  const { data, error } = await requireSupabaseClient()
    .from("article_revisions")
    .select(
      "id, title, excerpt, content, cover_image_url, category_id, seo_title, seo_description, created_at, editor:public_profiles(full_name)",
    )
    .eq("article_id", articleId)
    .order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Revision[];
};

function Compare({ revision, form }: { revision: Revision; form: EditorForm }) {
  const parts = useMemo(
    () => wordDiff(htmlToText(revision.content), htmlToText(form.content)),
    [revision.content, form.content],
  );
  const same = parts.every((part) => part.type === "same");

  return (
    <div className="max-h-[55svh] overflow-y-auto whitespace-pre-wrap rounded-xl border p-4 leading-relaxed">
      {same && <p className="mb-3 text-muted-foreground">El texto es igual al que tenés ahora.</p>}
      {parts.map((part, index) =>
        part.type === "same" ? (
          <span key={index}>{part.text}</span>
        ) : part.type === "del" ? (
          <del key={index} className="rounded bg-destructive/15 text-destructive-text">
            {part.text}
          </del>
        ) : (
          <ins key={index} className="rounded bg-success-soft text-success no-underline">
            {part.text}
          </ins>
        ),
      )}
    </div>
  );
}

export function History({
  articleId,
  form,
  onRestore,
}: {
  articleId: string | null;
  form: EditorForm;
  onRestore: (revision: Revision) => void;
}) {
  const [chosen, setChosen] = useState<Revision | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "revisions", articleId],
    queryFn: () => fetchRevisions(articleId ?? ""),
    enabled: Boolean(articleId),
    staleTime: 0,
  });

  if (!articleId) {
    return <p className="text-muted-foreground">El historial empieza cuando guardes la nota.</p>;
  }
  if (isError) {
    return (
      <div role="alert" className="space-y-2">
        <p>No pudimos cargar el historial.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (isPending) return <Skeleton className="h-40" />;
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground">
        Todavía no hay versiones anteriores. Cada vez que guardes un cambio aparece una acá.
      </p>
    );
  }

  return (
    <>
      <ul>
        {data.map((revision) => (
          <li key={revision.id} className="border-t first:border-t-0">
            <button
              type="button"
              onClick={() => setChosen(revision)}
              className={cn(
                "w-full rounded-lg px-2 py-2.5 text-left transition-colors duration-150 hover:bg-muted",
              )}
            >
              <span className="block font-medium">
                {when.format(new Date(revision.created_at))}
              </span>
              <span className="block text-[0.8125rem] text-muted-foreground">
                Cambiada por {revision.editor?.full_name ?? "alguien del equipo"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={chosen !== null} onOpenChange={(open) => !open && setChosen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Versión del {chosen ? when.format(new Date(chosen.created_at)) : ""}
            </DialogTitle>
            <DialogDescription>
              En rojo, lo que tenía esa versión. En verde, lo que tenés ahora.
            </DialogDescription>
          </DialogHeader>
          {chosen && <Compare revision={chosen} form={form} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChosen(null)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                if (chosen) onRestore(chosen);
                setChosen(null);
              }}
            >
              Usar esta versión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
