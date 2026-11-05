import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { EditorForm } from "@/lib/article-form";
import { prepareArticleHtml } from "@/lib/article-html";

export function PreviewDialog({
  form,
  open,
  onOpenChange,
}: {
  form: EditorForm;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const html = useMemo(() => (open ? prepareArticleHtml(form.content) : ""), [open, form.content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="site-preview max-h-[90svh] max-w-4xl overflow-y-auto bg-white p-6 text-[#1d2939] sm:p-10">
        <DialogTitle asChild>
          <h2 className="font-[Playfair_Display,Georgia,serif] text-4xl font-bold leading-tight">
            {form.title || "Sin título"}
          </h2>
        </DialogTitle>
        {form.excerpt && <p className="mt-3 text-lg text-[#5d6679]">{form.excerpt}</p>}
        {form.cover_image_url && (
          <img
            src={form.cover_image_url}
            alt=""
            className="mt-6 aspect-video w-full rounded-2xl object-cover"
          />
        )}
        <div className="prose-news mt-6" dangerouslySetInnerHTML={{ __html: html }} />
      </DialogContent>
    </Dialog>
  );
}
