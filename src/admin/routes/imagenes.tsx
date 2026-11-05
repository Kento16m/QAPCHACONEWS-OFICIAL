import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-news";
import { ImagePicker } from "../features/media/ImagePicker";
import {
  deleteMedia,
  imageUsage,
  listMedia,
  MEDIA_TYPES,
  PAGE_SIZE,
  updateAlt,
  type MediaAsset,
} from "../lib/media";
import { Skeleton } from "../ui/Field";

export const Route = createFileRoute("/imagenes")({ component: ImagesPage });

function AssetDialog({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [alt, setAlt] = useState(asset.alt);
  const [confirming, setConfirming] = useState(false);

  const usage = useQuery({
    queryKey: ["admin", "media-usage", asset.url],
    queryFn: () => imageUsage(asset.url),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "media"] });

  const save = useMutation({
    mutationFn: () => updateAlt(asset.id, alt.trim()),
    onSuccess: async () => {
      await refresh();
      toast.success("Descripción guardada.");
      onClose();
    },
    onError: () => toast.error("No pudimos guardar la descripción."),
  });

  const remove = useMutation({
    mutationFn: () => deleteMedia(asset),
    onSuccess: async () => {
      await refresh();
      toast.success("Imagen borrada.");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const notes = usage.data ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Imagen</DialogTitle>
          <DialogDescription>
            {asset.source === "upload" ? "Subida al sitio" : "Alojada en otro sitio"}
            {asset.width ? ` · ${asset.width} × ${asset.height} px` : ""}
          </DialogDescription>
        </DialogHeader>
        {asset.mime_type?.startsWith("video/") ? (
          <video src={asset.url} controls className="max-h-72 w-full rounded-xl bg-muted" />
        ) : (
          <img
            src={asset.url}
            alt={alt}
            className="max-h-72 w-full rounded-xl bg-muted object-contain"
          />
        )}
        <label className="block font-medium">
          Descripción
          <Input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="Qué se ve en la foto"
            className="mt-1.5"
          />
        </label>
        <div>
          <p className="font-medium">Dónde se usa</p>
          {usage.isPending ? (
            <Skeleton className="mt-1 h-5 w-48" />
          ) : notes.length === 0 ? (
            <p className="text-muted-foreground">En ninguna nota.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5">
              {notes.map((note) => (
                <li key={note.id}>{note.title}</li>
              ))}
            </ul>
          )}
        </div>
        {confirming && (
          <p role="alert" className="rounded-lg bg-warning-soft p-3 text-warning">
            {notes.length > 0
              ? `Se dejará de ver en ${notes.length === 1 ? "1 nota" : `${notes.length} notas`}. ¿Borrarla igual?`
              : "¿Borrarla de la biblioteca?"}
          </p>
        )}
        <DialogFooter className="gap-2">
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Borrar
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="sm:mr-auto"
                disabled={usage.isPending}
                onClick={() => setConfirming(true)}
              >
                Borrar
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                Guardar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImagesPage() {
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term, 300);
  const [adding, setAdding] = useState(false);
  const [chosen, setChosen] = useState<MediaAsset | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "media", page, debounced],
    queryFn: () => listMedia(page, debounced),
    placeholderData: keepPreviousData,
  });
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Imágenes</h1>
        {data && (
          <p className="text-muted-foreground">
            {data.total} {data.total === 1 ? "archivo" : "archivos"}
          </p>
        )}
        <Button size="lg" className="ml-auto rounded-lg px-4" onClick={() => setAdding(true)}>
          <Upload className="size-4" aria-hidden />
          Agregar
        </Button>
      </header>

      <section className="rounded-2xl border bg-card p-4">
        <Input
          type="search"
          aria-label="Buscar imágenes"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setPage(1);
          }}
          placeholder="Buscar por descripción"
          className="h-10 max-w-md rounded-lg"
        />

        {isError ? (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-3">
            <p>No pudimos cargar la biblioteca.</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : isPending ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="aspect-video" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-lg font-medium">
              {term ? "Ninguna imagen tiene esa descripción" : "La biblioteca está vacía"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {term ? "Probá con otra palabra." : "Agregá la primera imagen."}
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {data.rows.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => setChosen(asset)}
                  className="group w-full overflow-hidden rounded-xl border text-left transition-colors duration-150 hover:border-primary"
                >
                  {asset.mime_type?.startsWith("video/") ? (
                    <video
                      src={asset.url}
                      preload="metadata"
                      className="aspect-video w-full bg-muted"
                    />
                  ) : (
                    <img
                      src={asset.url}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full bg-muted object-cover"
                    />
                  )}
                  <span className="block truncate p-2 text-[0.8125rem] text-muted-foreground">
                    {asset.alt || "Sin descripción"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3">
            <p className="text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </nav>
        )}
      </section>

      <ImagePicker
        open={adding}
        onOpenChange={setAdding}
        onPick={() => toast.success("Agregada a la biblioteca.")}
        accept={MEDIA_TYPES}
        title="Agregar a la biblioteca"
      />
      {chosen && <AssetDialog asset={chosen} onClose={() => setChosen(null)} />}
    </>
  );
}
