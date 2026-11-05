import { useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-news";
import { cn } from "@/lib/utils";
import {
  IMAGE_TYPES,
  listMedia,
  PAGE_SIZE,
  registerImageUrl,
  uploadMedia,
  type MediaAsset,
} from "../../lib/media";
import { Skeleton } from "../../ui/Field";
import { Pager } from "../../ui/Pager";

type Tab = "library" | "upload" | "url";

const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Biblioteca" },
  { id: "upload", label: "Subir" },
  { id: "url", label: "Dirección web" },
];

export function ImagePicker({
  open,
  onOpenChange,
  onPick,
  accept = IMAGE_TYPES,
  title = "Elegir imagen",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: MediaAsset) => void;
  accept?: string;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("library");
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term, 300);
  const [address, setAddress] = useState("");
  const [alt, setAlt] = useState("");
  const [dragging, setDragging] = useState(false);

  // A cover or an inline photo cannot be a video.
  const imagesOnly = !accept.includes("video/");
  const library = useQuery({
    queryKey: ["admin", "media", page, debounced, imagesOnly],
    queryFn: () => listMedia(page, debounced, { imagesOnly }),
    enabled: open && tab === "library",
  });

  const finish = (asset: MediaAsset) => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
    setAddress("");
    setAlt("");
    onPick(asset);
    onOpenChange(false);
  };

  const upload = useMutation({
    mutationFn: (file: File) => uploadMedia(file, alt.trim()),
    onSuccess: finish,
  });
  const link = useMutation({
    mutationFn: () => registerImageUrl(address.trim(), alt.trim()),
    onSuccess: finish,
  });

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) upload.mutate(file);
  };

  const submitLink = (event: FormEvent) => {
    event.preventDefault();
    link.mutate();
  };

  const altField = (
    <label className="block font-medium">
      Descripción de la imagen
      <Input
        value={alt}
        onChange={(event) => setAlt(event.target.value)}
        placeholder="Qué se ve en la foto"
        className="mt-1.5"
      />
    </label>
  );
  const failure = upload.error ?? link.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Reutilizá una de la biblioteca, subila desde tu computadora o pegá su dirección web.
          </DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Origen de la imagen" className="flex gap-1 border-b pb-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition-colors duration-150",
                tab === item.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "library" && (
          <div>
            <Input
              type="search"
              aria-label="Buscar en la biblioteca"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por descripción"
            />
            <div className="mt-3 grid max-h-[50svh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {library.isPending &&
                Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} className="aspect-video" />
                ))}
              {library.data?.rows.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => finish(asset)}
                  aria-label={`Elegir ${asset.alt || "imagen sin descripción"}`}
                  className="overflow-hidden rounded-lg border transition-colors duration-150 hover:border-primary"
                >
                  <img
                    src={asset.url}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full bg-muted object-cover"
                  />
                </button>
              ))}
            </div>
            <Pager
              page={page}
              total={library.data?.total ?? 0}
              size={PAGE_SIZE}
              onChange={setPage}
            />
            {library.data?.rows.length === 0 && (
              <p className="mt-3 text-muted-foreground">
                {term
                  ? "Ninguna imagen tiene esa descripción."
                  : "La biblioteca está vacía. Subí la primera."}
              </p>
            )}
            {library.isError && (
              <p role="alert" className="mt-3 text-destructive-text">
                No pudimos cargar la biblioteca.
              </p>
            )}
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-3">
            {altField}
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-150",
                dragging ? "border-primary bg-accent" : "border-input hover:bg-muted",
              )}
            >
              <span className="font-medium">
                {upload.isPending ? "Subiendo…" : "Arrastrá el archivo o hacé clic para elegirlo"}
              </span>
              <span className="mt-1 text-muted-foreground">
                Las fotos se reducen solas para que carguen rápido.
              </span>
              <input
                type="file"
                accept={accept}
                aria-label="Elegir archivo"
                disabled={upload.isPending}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        )}

        {tab === "url" && (
          <form onSubmit={submitLink} className="space-y-3">
            <label className="block font-medium">
              Dirección de la imagen
              <Input
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="https://"
                className="mt-1.5"
              />
            </label>
            {altField}
            <p className="text-muted-foreground">
              La imagen sigue alojada en ese sitio: si la borran de allá, deja de verse acá.
            </p>
            <Button type="submit" disabled={link.isPending || !address.trim()}>
              {link.isPending ? "Comprobando…" : "Usar esta imagen"}
            </Button>
          </form>
        )}

        {failure && (
          <p role="alert" className="text-destructive-text">
            {failure.message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
