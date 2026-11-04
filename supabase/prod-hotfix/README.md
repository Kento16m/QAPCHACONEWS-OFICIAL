# Parche de seguridad para producción

Se aplica **solo en el proyecto actual de producción**, desde el panel de Supabase. Deja de hacer falta cuando la base nueva entre en servicio.

## 1. Comprobar qué hay hoy

En **SQL Editor**, ejecuta esto y guarda el resultado:

```sql
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;
select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal;
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles';
```

Compárteme el resultado **antes de aplicar nada**. Con eso confirmo si cualquier usuario puede hacerse administrador y que el parche encaja con tu base. La tabla `profiles` debe tener las columnas `role`, `is_blocked` y `blocked_reason`.

## 2. Aplicar el parche de la base

En **SQL Editor**, pega y ejecuta [2026-11-profile-guard.sql](2026-11-profile-guard.sql). Al final de ese archivo están las instrucciones para deshacerlo.

## 3. Corregir la función de comentarios

En **Edge Functions → moderate-comment → Code**:

1. Debajo de la línea `const body = await req.json();`, añade:

   ```ts
   const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
     auth: { persistSession: false, autoRefreshToken: false },
   });
   const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
   const { data: authData } = await authClient.auth.getUser(token);
   if (!authData?.user) {
     return new Response(JSON.stringify({ error: "Iniciá sesión para comentar." }), {
       status: 401,
       headers: { "Content-Type": "application/json", ...corsHeaders },
     });
   }
   const { data: authorProfile } = await authClient.from("profiles").select("is_blocked").eq("id", authData.user.id).maybeSingle();
   if (authorProfile?.is_blocked) {
     return new Response(JSON.stringify({ error: "Tu cuenta no puede publicar comentarios." }), {
       status: 403,
       headers: { "Content-Type": "application/json", ...corsHeaders },
     });
   }
   const user_id = authData.user.id;
   ```

2. Cambia la línea siguiente:

   ```ts
   // Antes
   const { article_id, parent_id = null, user_id, body: rawBody } = body ?? {};
   // Después
   const { article_id, parent_id = null, body: rawBody } = body ?? {};
   ```

3. Pulsa **Deploy**.

## 4. Verificar

- Con tu cuenta de administrador: cambiar el rol de otro usuario desde el panel sigue funcionando.
- Con una cuenta de lector: editar tu nombre y publicar un comentario siguen funcionando.
- Abre una noticia sin iniciar sesión: los autores siguen apareciendo.

Si algo falla, deshaz el paso 2 y avísame.
