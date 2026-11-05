import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasBlockedWord } from "./blocked-words.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const RATE_LIMIT_MESSAGE =
  "Superaste el límite de mensajes. Por favor, esperá 1 minuto antes de comentar otra vez.";

// Errors raised by public.service_post_comment.
const POST_ERRORS: Record<string, { status: number; message: string }> = {
  QC400: { status: 400, message: "El comentario al que respondés ya no existe." },
  QC403: { status: 403, message: "Tu cuenta no puede publicar comentarios." },
  QC404: { status: 404, message: "La noticia no está disponible para comentar." },
  QC429: { status: 429, message: RATE_LIMIT_MESSAGE },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Faltan variables de entorno del backend." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // The author comes from the verified session, never from the request body.
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: authData } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (!user) return json({ error: "Iniciá sesión para comentar." }, 401);

    const { article_id, parent_id = null, body: rawBody } = (await req.json()) ?? {};
    if (!article_id || !rawBody) return json({ error: "Faltan campos obligatorios." }, 400);

    const normalized = String(rawBody).trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 2000) {
      return json({ error: "El comentario debe tener entre 2 y 2000 caracteres." }, 400);
    }

    if (/(https?:\/\/|www\.)/i.test(normalized) && normalized.length < 120) {
      return json({ error: "Tu comentario parece spam o incluye enlaces no permitidos." }, 400);
    }

    if (hasBlockedWord(normalized)) {
      return json(
        {
          error:
            "Tu comentario no es apto para esta comunidad. Por favor, elimina palabras ofensivas o contenido inapropiado y vuelve a intentarlo.",
        },
        400,
      );
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey)
      return json({ error: "La moderación no está configurada en el servidor." }, 500);

    const moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({ input: normalized, model: "omni-moderation-latest" }),
      signal: AbortSignal.timeout(10_000),
    });
    const moderationData = await moderationResponse.json().catch(() => null);

    // If moderation cannot answer, nothing gets published.
    const result = moderationData?.results?.[0];
    if (!moderationResponse.ok || !result) {
      console.error("OpenAI moderation failed:", moderationResponse.status, moderationData);
      return json({ error: "La moderación falló temporalmente. Inténtalo nuevamente." }, 502);
    }

    if (result.flagged) {
      return json(
        {
          error:
            "Tu comentario fue bloqueado por la moderación por contener contenido inapropiado, odio o spam.",
        },
        400,
      );
    }

    const { data: comment, error } = await supabase.rpc("service_post_comment", {
      p_user_id: user.id,
      p_article_id: article_id,
      p_parent_id: parent_id,
      p_body: normalized,
    });

    if (error) {
      const known = POST_ERRORS[error.code ?? ""];
      if (known) return json({ error: known.message }, known.status);
      console.error("Insert comment error:", error);
      return json({ error: "No se pudo guardar el comentario." }, 500);
    }

    return json({ success: true, comment });
  } catch (error) {
    console.error("Edge function error:", error);
    return json({ error: "Error interno del servidor." }, 500);
  }
});
