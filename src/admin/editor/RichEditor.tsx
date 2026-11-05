import { useEffect, useRef, useState, type ComponentType, type FormEvent } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  Video as VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ImagePicker } from "../features/media/ImagePicker";
import { MEDIA_TYPES, uploadMedia, type MediaAsset } from "../lib/media";
import { embedUrlFor, extensions, toEditorHtml } from "./extensions";
import { cleanPastedHtml } from "./paste";

const allExtensions = [
  ...extensions,
  Placeholder.configure({ placeholder: "Escribí o pegá el texto de la nota…" }),
];

type Pending = "link" | "embed" | null;

const PROMPTS: Record<Exclude<Pending, null>, { title: string; label: string; button: string }> = {
  link: { title: "Agregar enlace", label: "Dirección del enlace", button: "Agregar" },
  embed: { title: "Insertar video", label: "Enlace de YouTube o Instagram", button: "Insertar" },
};

function ToolButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-9 items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-40",
        active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

function Toolbar({
  editor,
  onAsk,
  onPickImage,
}: {
  editor: Editor;
  onAsk: (kind: Pending) => void;
  onPickImage: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const separator = <span className="mx-1 h-6 w-px bg-border" aria-hidden />;

  return (
    <div
      role="toolbar"
      aria-label="Formato del texto"
      className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b bg-card p-2"
    >
      <ToolButton
        label="Negrita"
        icon={Bold}
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolButton
        label="Cursiva"
        icon={Italic}
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      {separator}
      <ToolButton
        label="Título"
        icon={Heading2}
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label="Subtítulo"
        icon={Heading3}
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      {separator}
      <ToolButton
        label="Lista"
        icon={List}
        active={state.bullet}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolButton
        label="Lista numerada"
        icon={ListOrdered}
        active={state.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolButton
        label="Cita"
        icon={Quote}
        active={state.quote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      {separator}
      <ToolButton
        label={state.link ? "Quitar enlace" : "Agregar enlace"}
        icon={Link2}
        active={state.link}
        onClick={() => (state.link ? chain().unsetLink().run() : onAsk("link"))}
      />
      <ToolButton label="Insertar imagen" icon={ImagePlus} onClick={onPickImage} />
      <ToolButton label="Insertar video" icon={VideoIcon} onClick={() => onAsk("embed")} />
      {separator}
      <ToolButton
        label="Deshacer"
        icon={Undo2}
        disabled={!state.canUndo}
        onClick={() => chain().undo().run()}
      />
      <ToolButton
        label="Rehacer"
        icon={Redo2}
        disabled={!state.canRedo}
        onClick={() => chain().redo().run()}
      />
    </div>
  );
}

const uploadAll = async (files: File[], insert: (asset: MediaAsset) => void) => {
  for (const file of files) {
    try {
      insert(await uploadMedia(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos subir el archivo.");
    }
  }
};

export function RichEditor({
  value,
  onChange,
  onEditorReady,
  readOnly = false,
}: {
  value: string;
  onChange: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  readOnly?: boolean;
}) {
  const lastEmitted = useRef(value);
  const [pending, setPending] = useState<Pending>(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const insertAssetRef = useRef<(asset: MediaAsset, at?: number) => void>(() => undefined);

  const editor = useEditor({
    extensions: allExtensions,
    content: toEditorHtml(value),
    editorProps: {
      attributes: { class: "note-editor", "aria-label": "Texto de la nota" },
      transformPastedHTML: cleanPastedHtml,
      // Dropping or pasting a file uploads it and leaves it where it landed.
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        if (files.length === 0) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadAll(files, (asset) => insertAssetRef.current(asset, at));
        return true;
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (files.length === 0) return false;
        event.preventDefault();
        void uploadAll(files, (asset) => insertAssetRef.current(asset));
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // A restored draft or version arrives from outside: typing must never pass through here.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
  }, [editor, value]);

  const insertAsset = (asset: MediaAsset, at?: number) => {
    const node = asset.mime_type?.startsWith("video/")
      ? { type: "video", attrs: { src: asset.url, controls: "true" } }
      : { type: "image", attrs: { src: asset.url, alt: asset.alt } };
    const chain = editor?.chain().focus();
    if (at === undefined) chain?.insertContent(node).run();
    else chain?.insertContentAt(at, node).run();
  };
  insertAssetRef.current = insertAsset;

  if (!editor) return <div className="min-h-[29rem] animate-pulse rounded-2xl bg-muted" />;

  const ask = (kind: Pending) => {
    setAddress("");
    setError(null);
    setPending(kind);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const url = address.trim();
    if (pending === "embed") {
      const src = embedUrlFor(url);
      if (!src) {
        setError("Ese enlace no es de un video de YouTube ni de una publicación de Instagram.");
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: "embed",
          attrs: { src, title: "Video", loading: "lazy", allowfullscreen: "true" },
        })
        .run();
    } else if (!/^https:\/\//i.test(url)) {
      setError("La dirección debe empezar con https://");
      return;
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setPending(null);
  };

  return (
    <div className="rounded-2xl border bg-card">
      <Toolbar editor={editor} onAsk={ask} onPickImage={() => setPicking(true)} />
      <EditorContent editor={editor} />
      <ImagePicker
        open={picking}
        onOpenChange={setPicking}
        accept={MEDIA_TYPES}
        title="Insertar imagen o video"
        onPick={(asset) => insertAsset(asset)}
      />

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          {pending && (
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>{PROMPTS[pending].title}</DialogTitle>
              </DialogHeader>
              <label className="mt-4 block font-medium">
                {PROMPTS[pending].label}
                <Input
                  autoFocus
                  required
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="https://"
                  className="mt-1.5"
                />
              </label>
              {error && (
                <p role="alert" className="mt-2 text-destructive-text">
                  {error}
                </p>
              )}
              <DialogFooter className="mt-5">
                <Button type="button" variant="outline" onClick={() => setPending(null)}>
                  Cancelar
                </Button>
                <Button type="submit">{PROMPTS[pending].button}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
