import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AssistError, DEFAULT_MODEL, parseRequest, runAssist } from "./assist.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Faltan variables de entorno del backend." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Who is asking comes from the verified session, never from the request body.
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: authData } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (!user) return json({ error: "Iniciá sesión para usar el asistente." }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_blocked")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile || profile.is_blocked || !["editor", "admin"].includes(profile.role)) {
      return json({ error: "El asistente es solo para el equipo." }, 403);
    }

    if (!apiKey) return json({ error: "El asistente no está configurado en el servidor." }, 500);

    const { action, input } = parseRequest(await req.json().catch(() => null));

    const { error: limitError } = await supabase.rpc("service_reserve_ai_use", {
      p_user_id: user.id,
    });
    if (limitError) {
      if (limitError.code === "QC429") return json({ error: limitError.message }, 429);
      throw limitError;
    }

    const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
    const { result, usage } = await runAssist(
      action,
      input,
      // If a safety check declines, the API retries on another model instead of stopping there.
      (params: never) =>
        client.beta.messages.create({
          ...(params as object),
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        } as never),
      Deno.env.get("ANTHROPIC_MODEL") ?? DEFAULT_MODEL,
    );

    const { error: usageError } = await supabase.rpc("service_record_ai_tokens", {
      p_user_id: user.id,
      p_input: usage.input_tokens,
      p_output: usage.output_tokens,
    });
    if (usageError) console.error("Could not record assistant usage:", usageError.message);

    return json({ result });
  } catch (error) {
    if (error instanceof AssistError) return json({ error: error.message }, error.status);
    console.error("editor-assist error:", error);
    return json({ error: "Error interno del servidor." }, 500);
  }
});
