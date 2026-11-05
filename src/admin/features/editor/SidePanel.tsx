import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAdminTags, type ArticleStatus } from "@/lib/admin";
import type { EditorForm } from "@/lib/article-form";
import { cn } from "@/lib/utils";
import { useAuthors, useCategories } from "../../lib/articles";
import { shareCard, type Issue } from "../../lib/save-article";
import { Select, STATUS_OPTIONS, Thumb } from "../../ui/Field";
import { ImagePicker } from "../media/ImagePicker";

const SITE = import.meta.env.VITE_APP_URL || "https://qapchaconews.com";
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

type Tab = "publicacion" | "seo" | "revision";

const TABS: { id: Tab; label: string }[] = [
  { id: "publicacion", label: "Publicación" },
  { id: "seo", label: "SEO" },
  { id: "revision", label: "Revisión" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex justify-between gap-3 font-medium">
        {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const counter = (value: string, max: number) => `${value.length} de ${max}`;

function PublishingFields({
  isNew,
  form,
  onChange,
  tagsReady,
}: {
  isNew: boolean;
  form: EditorForm;
  onChange: (changes: Partial<EditorForm>) => void;
  tagsReady: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const { data: categories } = useCategories();
  const { data: authors } = useAuthors();
  const { data: tags } = useQuery({ queryKey: ["admin", "tags"], queryFn: getAdminTags });

  const toggleTag = (id: string) =>
    onChange({
      tag_ids: form.tag_ids.includes(id)
        ? form.tag_ids.filter((tag) => tag !== id)
        : [...form.tag_ids, id],
    });

  return (
    <div className="space-y-4">
      <Field label="Estado">
        <Select
          className="w-full"
          value={form.status}
          onChange={(event) => onChange({ status: event.target.value as ArticleStatus })}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      {form.status === "scheduled" && (
        <Field label="Fecha de publicación" hint="Hora de Paraguay">
          <Input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(event) => onChange({ scheduled_at: event.target.value })}
            className="h-10 rounded-lg"
          />
        </Field>
      )}

      <div>
        <p className="font-medium">Foto de portada</p>
        {form.cover_image_url ? (
          <Thumb
            src={form.cover_image_url}
            alt="Foto de portada elegida"
            className="mt-1.5 aspect-video w-full rounded-xl bg-muted object-cover"
          />
        ) : (
          <p className="mt-1 text-muted-foreground">Todavía no elegiste una.</p>
        )}
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            {form.cover_image_url ? "Cambiar" : "Elegir foto"}
          </Button>
          {form.cover_image_url && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ cover_image_url: "" })}>
              Quitar
            </Button>
          )}
        </div>
        <ImagePicker
          open={picking}
          onOpenChange={setPicking}
          title="Foto de portada"
          onPick={(asset) => onChange({ cover_image_url: asset.url })}
        />
      </div>

      <Field label="Sección">
        <Select
          className="w-full"
          value={form.category_id ?? ""}
          onChange={(event) => onChange({ category_id: event.target.value || null })}
        >
          <option value="">Sin sección</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Autor">
        <Select
          className="w-full"
          value={form.author_id ?? ""}
          onChange={(event) => onChange({ author_id: event.target.value || null })}
        >
          <option value="">{isNew ? "Yo" : "Redacción"}</option>
          {authors?.map((author) => (
            <option key={author.id} value={author.id}>
              {author.full_name ?? "Sin nombre"}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset disabled={!tagsReady}>
        <legend className="font-medium">Etiquetas</legend>
        {tags?.length === 0 && (
          <p className="mt-1 text-muted-foreground">No hay etiquetas todavía.</p>
        )}
        <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {tags?.map((tag) => {
            const on = form.tag_ids.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[0.8125rem] transition-colors duration-150 disabled:opacity-50",
                  on
                    ? "border-transparent bg-accent text-accent-foreground"
                    : "border-input hover:bg-muted",
                )}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 font-medium">
        <input
          type="checkbox"
          checked={form.is_breaking}
          onChange={(event) => onChange({ is_breaking: event.target.checked })}
          className="size-4 accent-primary"
        />
        Última hora
      </label>
    </div>
  );
}

function ShareCard({ form }: { form: EditorForm }) {
  const card = shareCard(form, SITE);
  return (
    <div>
      <h3 className="font-medium">Al compartir en WhatsApp y Facebook</h3>
      <div className="mt-1.5 overflow-hidden rounded-xl border">
        <img src={card.image} alt="" className="aspect-[1.91/1] w-full bg-muted object-cover" />
        <div className="bg-muted p-3">
          <p className="text-xs uppercase text-muted-foreground">{card.host}</p>
          <p className="mt-0.5 line-clamp-2 font-semibold">{card.title || "Sin título"}</p>
          {card.description && (
            <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-muted-foreground">
              {card.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SeoFields({
  form,
  onChange,
}: {
  form: EditorForm;
  onChange: (changes: Partial<EditorForm>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Resumen">
        <Textarea
          rows={3}
          value={form.excerpt}
          onChange={(event) => onChange({ excerpt: event.target.value })}
          className="rounded-lg"
        />
      </Field>
      <Field label="Título para buscadores" hint={counter(form.seo_title, SEO_TITLE_MAX)}>
        <Input
          value={form.seo_title}
          onChange={(event) => onChange({ seo_title: event.target.value })}
          className="h-10 rounded-lg"
        />
      </Field>
      <Field
        label="Descripción para buscadores"
        hint={counter(form.seo_description, SEO_DESCRIPTION_MAX)}
      >
        <Textarea
          rows={3}
          value={form.seo_description}
          onChange={(event) => onChange({ seo_description: event.target.value })}
          className="rounded-lg"
        />
      </Field>
      <Field label="Dirección de la nota" hint="Se genera sola si la dejás vacía">
        <Input
          value={form.slug}
          onChange={(event) => onChange({ slug: event.target.value })}
          className="h-10 rounded-lg"
        />
      </Field>
      <ShareCard form={form} />
    </div>
  );
}

function ReviewList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-success">
        <CircleCheck className="size-5 shrink-0" aria-hidden />
        Está lista para publicar.
      </p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground">Podés publicarla igual, pero conviene revisar esto:</p>
      <ul className="mt-3 space-y-2">
        {issues.map((issue) => (
          <li key={issue.id} className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            {issue.message}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SidePanel({
  isNew,
  form,
  onChange,
  issues,
  tagsReady,
  extraTabs = [],
}: {
  isNew: boolean;
  form: EditorForm;
  onChange: (changes: Partial<EditorForm>) => void;
  issues: Issue[];
  tagsReady: boolean;
  extraTabs?: { id: string; label: string; content: ReactNode }[];
}) {
  const [tab, setTab] = useState<string>("publicacion");

  return (
    <aside className="min-w-0 rounded-2xl border bg-card lg:sticky lg:top-[8.125rem] lg:col-span-4 lg:max-h-[calc(100svh-9.125rem)] lg:overflow-y-auto">
      <div
        role="tablist"
        aria-label="Datos de la nota"
        className="flex flex-wrap gap-0.5 border-b p-2 xl:flex-nowrap"
      >
        {[...TABS, ...extraTabs].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150",
              tab === item.id ? "bg-accent text-accent-foreground" : "hover:bg-muted",
            )}
          >
            {item.label}
            {item.id === "revision" && issues.length > 0 && ` (${issues.length})`}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-4">
        {tab === "publicacion" && (
          <PublishingFields isNew={isNew} form={form} onChange={onChange} tagsReady={tagsReady} />
        )}
        {tab === "seo" && <SeoFields form={form} onChange={onChange} />}
        {tab === "revision" && <ReviewList issues={issues} />}
        {extraTabs.find((item) => item.id === tab)?.content}
      </div>
    </aside>
  );
}
