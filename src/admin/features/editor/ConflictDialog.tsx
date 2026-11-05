import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { AdminArticle } from "@/lib/admin";
import type { EditorForm } from "@/lib/article-form";
import { prepareArticleHtml } from "@/lib/article-html";

export function ConflictDialog({
  mine,
  theirs,
  onCancel,
  onOverwrite,
  onUseTheirs,
}: {
  mine: EditorForm;
  theirs: AdminArticle | null;
  onCancel: () => void;
  onOverwrite: () => void;
  onUseTheirs: () => void;
}) {
  const [showing, setShowing] = useState(false);

  return (
    <AlertDialog open={theirs !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Otra persona guardó esta nota</AlertDialogTitle>
          <AlertDialogDescription>
            {theirs?.author?.full_name ? `La nota es de ${theirs.author.full_name}. ` : ""}
            Tu texto sigue acá, sin guardar. Mirá lo que guardó antes de decidir: si guardás lo
            tuyo, lo suyo queda en el historial.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {showing && theirs && (
          <div className="site-preview max-h-80 overflow-y-auto rounded-xl border p-4">
            <h2 className="mb-2 text-lg font-bold">{theirs.title}</h2>
            {theirs.title !== mine.title && <p className="mb-2 text-sm">Tu título: {mine.title}</p>}
            <div
              className="prose-news"
              dangerouslySetInnerHTML={{ __html: prepareArticleHtml(theirs.content) }}
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Seguir editando
          </Button>
          <Button variant="outline" onClick={() => setShowing(!showing)}>
            {showing ? "Ocultar lo que guardó" : "Ver lo que guardó"}
          </Button>
          <Button variant="outline" onClick={onUseTheirs}>
            Usar lo suyo
          </Button>
          <Button onClick={onOverwrite}>Guardar lo mío</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
