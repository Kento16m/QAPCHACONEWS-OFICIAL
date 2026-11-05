import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminTags } from "@/lib/admin";
import type { EditorForm } from "@/lib/article-form";
import { readFunctionError } from "@/lib/function-error";
import { requireSupabaseClient } from "@/lib/supabase";
import { applyFix } from "../../lib/apply-fix";
import { htmlToText } from "../../lib/word-diff";

type Action = "titles" | "summary" | "seo" | "tags" | "proofread";
type Fix = { original: string; replacement: string; reason: string };
type Result = {
  titles?: string[];
  summary?: string;
  seo_title?: string;
  seo_description?: string;
  existing?: string[];
  new?: string[];
  fixes?: Fix[];
};

const ACTIONS: { id: Action; label: string }[] = [
  { id: "titles", label: "Títulos" },
  { id: "summary", label: "Resumen" },
  { id: "seo", label: "SEO" },
  { id: "tags", label: "Etiquetas" },
  { id: "proofread", label: "Ortografía" },
];

function Suggestion({
  children,
  onUse,
  onDiscard,
  useLabel = "Usar",
}: {
  children: React.ReactNode;
  onUse: () => void;
  onDiscard: () => void;
  useLabel?: string;
}) {
  return (
    <li className="rounded-xl border p-3">
      <div>{children}</div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={onUse}>
          <Check className="size-4" aria-hidden />
          {useLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          <X className="size-4" aria-hidden />
          Descartar
        </Button>
      </div>
    </li>
  );
}

export function AiPanel({
  form,
  editor,
  onChange,
}: {
  form: EditorForm;
  editor: Editor | null;
  onChange: (changes: Partial<EditorForm>) => void;
}) {
  const { data: tags } = useQuery({ queryKey: ["admin", "tags"], queryFn: getAdminTags });
  const [result, setResult] = useState<Result | null>(null);
  const [gone, setGone] = useState<string | null>(null);

  const ask = useMutation({
    mutationFn: async (action: Action) => {
      const { data, error } = await requireSupabaseClient().functions.invoke("editor-assist", {
        body: {
          action,
          title: form.title,
          text: htmlToText(form.content),
          tags: tags?.map((tag) => tag.name) ?? [],
        },
      });
      if (error) {
        const { message } = await readFunctionError(error);
        throw new Error(message ?? "El asistente no respondió.");
      }
      return (data as { result: Result }).result;
    },
    onMutate: () => {
      setResult(null);
      setGone(null);
    },
    onSuccess: setResult,
  });

  const drop = (changes: Partial<Result>) =>
    setResult((value) => (value ? { ...value, ...changes } : value));

  const addTag = (name: string) => {
    const tag = tags?.find((item) => item.name === name);
    if (tag && !form.tag_ids.includes(tag.id)) onChange({ tag_ids: [...form.tag_ids, tag.id] });
  };

  const empty =
    result &&
    !result.titles?.length &&
    !result.summary &&
    !result.seo_title &&
    !result.seo_description &&
    !result.existing?.length &&
    !result.new?.length &&
    !result.fixes?.length;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Te propone textos a partir de tu nota. Revisá cada uno: puede equivocarse, y nada cambia
        hasta que elegís Usar.
      </p>

      <div role="group" aria-label="Pedir sugerencias" className="flex flex-wrap gap-1.5">
        {ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="sm"
            disabled={ask.isPending}
            onClick={() => ask.mutate(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <div aria-live="polite">
        {ask.isPending && <p className="text-muted-foreground">Leyendo la nota…</p>}
        {ask.isError && (
          <p role="alert" className="text-destructive-text">
            {ask.error.message} Podés seguir escribiendo sin problema.
          </p>
        )}
        {gone && (
          <p role="status" className="mb-2 text-warning">
            Ese texto ya cambió, así que no tocamos nada: “{gone}”.
          </p>
        )}
        {empty && <p className="text-muted-foreground">Nada que sugerir. Se ve bien.</p>}

        <ul className="space-y-2">
          {result?.titles?.map((title) => (
            <Suggestion
              key={title}
              onUse={() => {
                onChange({ title });
                drop({ titles: [] });
              }}
              onDiscard={() =>
                drop({ titles: result.titles?.filter((item) => item !== title) ?? [] })
              }
            >
              {title}
            </Suggestion>
          ))}

          {result?.summary && (
            <Suggestion
              onUse={() => {
                onChange({ excerpt: result.summary ?? "" });
                drop({ summary: "" });
              }}
              onDiscard={() => drop({ summary: "" })}
            >
              {result.summary}
            </Suggestion>
          )}

          {result?.seo_title && (
            <Suggestion
              onUse={() => {
                onChange({
                  seo_title: result.seo_title ?? "",
                  seo_description: result.seo_description ?? "",
                });
                drop({ seo_title: "", seo_description: "" });
              }}
              onDiscard={() => drop({ seo_title: "", seo_description: "" })}
            >
              <p className="font-medium">{result.seo_title}</p>
              <p className="mt-1 text-muted-foreground">{result.seo_description}</p>
            </Suggestion>
          )}

          {result?.existing?.map((name) => (
            <Suggestion
              key={name}
              useLabel="Agregar"
              onUse={() => {
                addTag(name);
                drop({ existing: result.existing?.filter((item) => item !== name) ?? [] });
              }}
              onDiscard={() =>
                drop({ existing: result.existing?.filter((item) => item !== name) ?? [] })
              }
            >
              {name}
            </Suggestion>
          ))}

          {result?.fixes?.map((fix) => (
            <Suggestion
              key={`${fix.original}-${fix.replacement}`}
              useLabel="Corregir"
              onUse={() => {
                const outcome = editor ? applyFix(editor, fix.original, fix.replacement) : "gone";
                setGone(outcome === "gone" ? fix.original : null);
                drop({ fixes: result.fixes?.filter((item) => item !== fix) ?? [] });
              }}
              onDiscard={() => drop({ fixes: result.fixes?.filter((item) => item !== fix) ?? [] })}
            >
              <p>
                <del className="text-destructive-text">{fix.original}</del>
                {" → "}
                <ins className="text-success no-underline">{fix.replacement}</ins>
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">{fix.reason}</p>
            </Suggestion>
          ))}
        </ul>

        {result?.new && result.new.length > 0 && (
          <p className="mt-3 text-muted-foreground">
            También sugiere etiquetas que no existen: {result.new.join(", ")}. Un administrador
            puede crearlas en Categorías y etiquetas.
          </p>
        )}
      </div>
    </div>
  );
}
