# Plan para dejar impecable QAP ChacoNews

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** llevar a producción un sitio de noticias seguro, rápido y bien posicionado, con un panel propio en `admin.qapchaconews.com`, y poder mantenerlo sin miedo a romperlo.

**Architecture:** React y Vite como SPA en Netlify, con Supabase como base, autenticación, almacenamiento y funciones. La seguridad vive en la base (RLS y permisos por columna), no en el navegador. Sitio y panel salen del mismo repositorio como dos compilaciones y dos sitios de Netlify.

**Tech Stack:** React 19, TanStack Router y Query, Tailwind 4, Vite, Vitest, Playwright (nuevo), Supabase (Postgres 17, Auth, Storage, Edge Functions, pg_cron), Netlify Functions y Edge Functions.

**Spec:** este plan parte de la auditoría del 2026-11-04. La sección [Hallazgos](#hallazgos-y-dónde-se-resuelven) lista cada punto y su tarea. La Fase 4 tendrá su propia especificación y su propio plan.

## Estado de partida (2026-11-04)

- **Producción:** sitio en Netlify (`qapchaconews.com`) y base `nkkgwjvmdxggvyzehlzp` en el repo viejo. Sin cambios. Contiene los fallos de seguridad si coincide con los SQL del repo viejo: falta confirmarlo.
- **Base nueva:** `ooswoucakxnymtdblrzd`, vacía salvo las 15 categorías. Esquema y permisos listos: `npm run test:db` pasa 123 de 123.
- **Repo de trabajo:** `Kento16m/QAPCHACONEWS-OFICIAL`, rama local `oficial`. Todavía no se despliega en ningún sitio.
- **Datos públicos en producción:** 17 perfiles, 30 artículos publicados y 45 comentarios.

## Por qué este orden

Producción sigue expuesta mientras la base nueva no entre en servicio, así que **la migración va antes que el panel nuevo**. El panel actual ya funciona contra la base nueva y solo hay que corregirle los bugs que pierden trabajo. Así la seguridad llega pronto, y el panel nuevo se construye después sin prisa y sobre datos reales.

| Fase | Objetivo | Tamaño |
|---|---|---|
| 0 | Cerrar el riesgo de hoy y tomar decisiones | Pequeña |
| 1 | Corregir los bugs de la app y probarla en un navegador | Mediana |
| 2 | Migrar datos y poner la base nueva en producción | Mediana |
| 3 | Limpiar el código y activar controles automáticos | Mediana |
| 4 | Panel nuevo en `admin.qapchaconews.com` | Grande |
| 5 | SEO, velocidad y accesibilidad | Mediana |
| 6 | Operación: copias, monitoreo y documentación | Pequeña |

## Global Constraints

- **Producción:** no se toca sin aprobación del dueño para ese paso concreto.
- **Secretos:** ningún token, clave de servicio o contraseña en archivos, commits o logs. Nunca se usa el enlace de GitHub para permitir un secreto.
- **Git:** se trabaja y se sube desde `oficial` al remoto `oficial`. `main` y `origin` (conectados a Lovable) no se usan, y no se reescribe historial ya publicado.
- **Base de datos:** todo cambio entra como archivo nuevo en `supabase/migrations/`, con su prueba en `supabase/tests/security.sql`. No se edita a mano en producción.
- **Permisos:** se comprueban en la base. El navegador solo decide qué mostrar.
- **Pruebas:** el test se escribe primero y se ve fallar. Cada fase cierra con `npm test`, `npm run test:db` y la compilación en verde.
- **Dependencias:** solo se añade una si evita mucho código. Hoy las justificadas son Playwright y el editor de la Fase 4.
- **Idioma:** los textos de la interfaz van en español de Paraguay, con el voseo que ya usa el sitio. El horario de referencia es `America/Asuncion`.

## Review Focus

Casos que ninguna prueba cubría y que más afectarían a una persona real. Cada uno tiene su prueba en la tarea indicada.

1. **Usuario existente que entra tras la migración,** con contraseña vieja o con Google: debe entrar sin registrarse otra vez ni perder su rol o sus comentarios (Tarea 2.2).
2. **Imágenes con URL de la base vieja:** al apagar esa base no debe romperse ninguna portada, imagen interna ni avatar (Tarea 2.3).
3. **Editor que pierde la sesión o la conexión mientras escribe:** recupera el texto al volver (Tarea 1.3).
4. **Búsqueda con `( ) , % " \` o solo espacios:** nunca da error, y un comentario con solo emojis se publica bien (Tareas 1.1 y 1.7).
5. **Servicio externo caído** (OpenWeather, cotizaciones, OpenAI): la página sigue usable y nada sin moderar se publica (Tarea 1.7).

---

## Fase 0: cerrar el riesgo de hoy

**Sale cuando:** los tokens están revocados, producción no permite hacerse administrador y las decisiones están tomadas.

### Tarea 0.1: acciones del dueño

- [ ] Revocar los dos tokens de Supabase compartidos por chat.
- [ ] Cambiar la clave de OpenWeather y guardar la nueva en `.env` local.
- [ ] Guardar `OPENAI_API_KEY` como secreto en el proyecto nuevo.
- [ ] Responder las [decisiones pendientes](#decisiones-pendientes-del-dueño).

### Tarea 0.2: confirmar y parchear producción

**Files:**
- Create: `supabase/prod-hotfix/2026-11-profile-guard.sql`

**Interfaces:**
- Produces: trigger `profiles_guard` en producción. Compatible con el código actual, que hace `upsert` de perfiles.

- [ ] **Paso 1:** el dueño ejecuta en producción esta consulta y comparte el resultado:

```sql
select policyname, cmd, qual, with_check from pg_policies where tablename in ('profiles', 'comments');
select tgname from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal;
```

- [ ] **Paso 2:** si un usuario puede cambiar su propio `role`, escribir un trigger `before insert or update` que rechace cambios de `role` o `is_blocked` si quien llama no es administrador. También debe forzar `role = 'reader'` e `is_blocked = false` en perfiles nuevos, salvo para `service_role`.
- [ ] **Paso 3:** el dueño lo ejecuta y confirma con una cuenta de lector que `PATCH profiles role=admin` falla y que editar el nombre sigue funcionando.
- [ ] **Paso 4:** corregir la función `moderate-comment` de producción para tomar el usuario de la sesión. Ver [index.ts](../../../supabase/functions/moderate-comment/index.ts), adaptado a las funciones que producción ya tiene.
- [ ] **Paso 5:** commit del SQL.

Si el dueño prefiere no dar acceso a producción, estos pasos se ejecutan guiados desde su panel de Supabase.

---

## Fase 1: corregir los bugs de la app

**Sale cuando:** `npm test` cubre cada bug de esta fase y la prueba en navegador pasa contra la base nueva.

### Tarea 1.1: buscador

**Files:**
- Modify: `src/lib/api.ts:259-313`
- Test: `src/lib/api.test.ts`

**Interfaces:**
- Produces: `buildSearchFilter(term: string, categoryIds: string[]): string`, el texto del filtro `.or()`.

- [ ] Test: `buildSearchFilter('cultura', ['id-1'])` incluye `title`, `subtitle`, `excerpt` y `category_id.in.(id-1)` en un solo OR.
- [ ] Test: `buildSearchFilter('Chaco (Paraguay), 100% "ya"', [])` entrega cada valor entre comillas dobles, con `"` y `\` escapados.
- [ ] Test: buscar solo espacios devuelve la lista normal sin filtro y sin error.
- [ ] Verlos fallar, implementar `buildSearchFilter` y usarlo en `searchArticles`.
- [ ] Comprobar contra la API real que `( ) , % " \` devuelven 200. Verde y commit.

### Tarea 1.2: guardado de artículos (SEO, fecha y hora)

**Files:**
- Create: `src/lib/article-form.ts`
- Modify: `src/lib/admin.ts` (leer `seo_title` y `seo_description`), `src/routes/admin.tsx:113-193, 1283-1340`
- Test: `src/lib/article-form.test.ts`, ejecutado con `TZ=America/Asuncion`

**Interfaces:**
- Produces:
  - `EditorForm` (se mueve desde `admin.tsx`)
  - `toDateTimeLocal(iso: string | null): string`
  - `fromDateTimeLocal(value: string): string | null`
  - `formFromArticle(article: AdminArticle, tagIds: string[]): EditorForm`
  - `buildArticlePayload(form: EditorForm, existing: AdminArticle | null, now: Date): ArticlePayload`

- [ ] Test: `buildArticlePayload` conserva `published_at` al editar una nota ya publicada.
- [ ] Test: pasar de borrador a publicado usa `now`.
- [ ] Test: los campos SEO cargados con `formFromArticle` sobreviven al guardado.
- [ ] Test: `fromDateTimeLocal(toDateTimeLocal(x)) === x` en `America/Asuncion`. La hora no se mueve al guardar varias veces.
- [ ] Test: programar sin fecha lanza `"Elegí la fecha de publicación."`, y la base también lo rechaza.
- [ ] Verlos fallar e implementar.
- [ ] `trackArticlePublished` solo se dispara al pasar a publicado, no en cada guardado.
- [ ] Verde y commit.

### Tarea 1.3: el editor no pierde el trabajo

**Files:**
- Create: `src/hooks/use-article-form.ts`
- Modify: `src/routes/admin.tsx:921-970`
- Test: `src/hooks/use-article-form.test.tsx`

**Interfaces:**
- Consumes: `EditorForm` y `formFromArticle` de la Tarea 1.2.
- Produces: `useArticleForm(article: AdminArticle | null, tagIds: string[]): { form, setForm, reset, hasRestoredDraft }`, que guarda un borrador en `localStorage` bajo `qap_article_draft:<id|new>`.

- [ ] Test: si la lista de artículos se recarga con el mismo `id`, lo escrito se mantiene.
- [ ] Test: si llega una lista nueva durante una nota nueva, el formulario no se vacía.
- [ ] Test: cambiar a otro `id` carga el artículo nuevo.
- [ ] Test: tras recargar sin guardar, el borrador se recupera, y `reset()` lo borra al guardar con éxito (Review Focus 3).
- [ ] Verlos fallar, implementar y conectar en `admin.tsx`. Verde y commit.

### Tarea 1.4: sesión y registro

**Files:**
- Modify: `src/lib/auth.ts:282-309`, `src/hooks/useAuth.tsx`, `src/components/auth/forms.tsx:76-87`
- Test: `src/lib/auth.test.ts`

- [ ] Test: el callback de `onAuthStateChange` no llama a Supabase de forma síncrona. Con el perfil diferido por `setTimeout(0)` ya no hay riesgo de bloqueo.
- [ ] Test: un inicio de sesión carga el perfil una sola vez.
- [ ] Test: registrarse con confirmación pendiente muestra un aviso de éxito y no deja a la persona como conectada.
- [ ] Verlos fallar, implementar y quitar los respaldos `42703` que ya no aplican. Verde y commit.

### Tarea 1.5: portada y listas

**Files:**
- Modify: `src/lib/api.ts:5-27, 91-164`
- Test: `src/lib/api.test.ts`

- [ ] Test: sin nota destacada, `getFeaturedArticle` devuelve la última publicada.
- [ ] Test: portada, ticker, más leídas y relacionadas piden el listado sin `content`. `getBreakingArticles` limita a 10.
- [ ] Verlos fallar, implementar con `makeArticleSelect(false)` y confirmar que solo `noticia.$slug.tsx` usa `content`. Verde y commit.

### Tarea 1.6: analítica y consentimiento

**Files:**
- Modify: `netlify.toml`, `src/main.tsx:10-12`, `src/lib/analytics.ts`
- Create: `src/components/news/CookieBanner.tsx`
- Test: `src/lib/analytics.test.ts`

La Política de Cookies menciona consentimiento y analítica, pero el código no pide consentimiento y GA arranca siempre.

- [ ] Test: sin consentimiento guardado, `analytics.initialize` no carga GA. Con aceptación sí, y el rechazo queda recordado.
- [ ] Verlo fallar, implementar y añadir un banner mínimo: Aceptar, Rechazar y enlace a la política.
- [ ] Añadir a la CSP `https://www.googletagmanager.com` en `script-src` y `https://*.google-analytics.com https://*.analytics.google.com` en `connect-src`.
- [ ] Comprobar en el navegador que no hay errores de CSP y que tras aceptar llega la visita a GA. Commit.

### Tarea 1.7: errores visibles y servicios caídos

**Files:**
- Modify: `src/lib/admin.ts:269-307`, `src/routes/admin.tsx` (PDF y borrado de artículo), `src/components/news/CommentsSection.tsx`
- Test: `src/lib/admin.test.ts`, `e2e/smoke.spec.ts`

- [ ] Test: un error de permisos en `getAdminAccessLogs` se propaga en vez de devolver una lista vacía. La consulta limita a 500 filas.
- [ ] Corregir el PDF de Control de Acceso, que hoy siempre muestra "bloqueado" porque `noopener` hace que `window.open` devuelva `null`.
- [ ] Capturar y mostrar los errores de borrado de artículos y de categorías.
- [ ] Test (Review Focus 5): con OpenWeather y cotizaciones respondiendo 500, la portada carga y los widgets muestran su estado de error.
- [ ] Test (Review Focus 4): un comentario con solo emojis se publica, y si OpenAI falla se ve un mensaje y no se guarda nada.
- [ ] Verde y commit.

### Tarea 1.8: prueba real en navegador

**Files:**
- Create: `e2e/smoke.spec.ts`, `playwright.config.ts`
- Modify: `package.json` (añade `@playwright/test` y `test:e2e`)

**Interfaces:**
- Consumes: variables `E2E_SUPABASE_URL`, `E2E_ANON_KEY`, `E2E_SERVICE_KEY` dadas al ejecutar. Nunca se guardan en archivos.

- [ ] Escribir el flujo con cuentas temporales que se borran al terminar: registrarse, entrar, comentar, dar like, entrar como editor, crear y publicar una nota con portada, verla en la portada, buscarla y cerrar sesión.
- [ ] Añadir: un lector que abre `/admin` no ve datos del panel, y un usuario bloqueado es expulsado.
- [ ] Ejecutar contra la base nueva, corregir lo que falle y commit.

---

## Fase 2: migración y puesta en producción

**Sale cuando:** `qapchaconews.com` sirve desde `oficial` con la base nueva, los conteos coinciden y el plan de vuelta atrás se ha ensayado.

### Tarea 2.1: script de importación y ensayo

**Files:**
- Create: `scripts/migrate/import-prod.mjs`, `scripts/migrate/verify.mjs`
- Test: `scripts/migrate/transform.test.mjs`

**Interfaces:**
- Consumes: volcado local fuera del repo, generado por el dueño con `supabase db dump --data-only` para `public`, `auth` y `storage`.

- [ ] El dueño entrega el volcado. Se guarda fuera del repo porque contiene correos y hashes de contraseñas.
- [ ] Test de transformación: los comentarios `pending_review` entran como comentarios normales, `article_id` queda como `uuid`, los likes se deduplican y los comentarios huérfanos se listan sin importarlos.
- [ ] Confirmar qué contienen en producción `article_views` y las demás tablas eliminadas. Si hay datos valiosos, se recuperan con una migración antes de importar.
- [ ] Ejecutar el ensayo sobre una copia desechable. `verify.mjs` debe coincidir en perfiles, artículos, comentarios, likes, suscriptores y archivos, y `npm run test:db` debe seguir en verde.

### Tarea 2.2: cuentas y sesiones

- [ ] Importar `auth.users` y `auth.identities` con los mismos ID y hashes.
- [ ] Marcar al dueño como administrador protegido (`is_protected = true`).
- [ ] Prueba (Review Focus 1): con una cuenta real de prueba del dueño, antes y después, entrar con contraseña y con Google. El rol y los comentarios deben conservarse.
- [ ] Avisar a los usuarios: todas las sesiones se cierran y hay que volver a entrar, porque cambia la clave de firma.

### Tarea 2.3: archivos e imágenes

- [ ] Copiar los objetos de `article-covers` y `article-media`, e informar los que no cumplan los tipos permitidos.
- [ ] Reescribir `cover_image_url`, `articles.content` y `profiles.avatar_url` a la URL nueva.
- [ ] Prueba (Review Focus 2): `verify.mjs` confirma 0 referencias a `nkkgwjvmdxggvyzehlzp` en esas columnas, y cada URL de imagen responde 200.

### Tarea 2.4: configurar servicios

- [ ] Correo propio (SMTP), porque el límite por defecto de 2 correos por hora rompe el registro y la recuperación.
- [ ] Credenciales de Google y Facebook, o quitar esos botones si no se usarán.
- [ ] Variables de entorno en Netlify, según `.env.example`.
- [ ] Sitio de pruebas de Netlify desde `oficial`, con la base nueva. `npm run test:e2e` pasa allí.

### Tarea 2.5: el cambio

Requiere aprobación explícita del dueño el mismo día.

- [ ] Avisar al equipo editorial y congelar las publicaciones.
- [ ] Copia de seguridad final, importación de lo nuevo y `verify.mjs`.
- [ ] Apuntar el sitio de Netlify de producción a `oficial`.
- [ ] Comprobar en vivo: portada, una nota, entrar, comentar y publicar.
- [ ] **Vuelta atrás:** restaurar el despliegue anterior en Netlify. La base vieja se conserva 30 días. Lo publicado después del cambio habría que copiarlo a mano.
- [ ] Desconectar Lovable si esa es la decisión tomada.

---

## Fase 3: limpieza y controles automáticos

**Sale cuando:** `tsc` da 0 errores, ESLint da 0 errores y GitHub Actions bloquea cualquier cambio que rompa algo.

### Tarea 3.1: borrar lo que no se usa

- [ ] Borrar 36 componentes sin uso de `src/components/ui` y `src/hooks/use-mobile.tsx`.
- [ ] Quitar las 29 dependencias que solo ellos usaban.
- [ ] Borrar `src/data/mock.ts`, `src/server.ts`, `src/start.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/pages/admin/.gitkeep`, la carpeta vacía `QAPCHACONEWS`, y las capturas y logos sin referencias en `public/`.
- [ ] Quitar `@tanstack/react-start`, `nitro` y la config de Lovable si se decide desconectarlo.
- [ ] Dejar un solo gestor de paquetes, npm: borrar `bun.lock` y `bunfig.toml`.
- [ ] Borrar `.htaccess` si se descarta Hostinger, y `public/_redirects`, que duplica `netlify.toml`.
- [ ] Copiar solo el CSS y las fuentes de `weather-icons-master` y borrar el resto.
- [ ] Antes de cada borrado, buscar en todo el repo. Tras cada grupo, `npm test` y compilación. Commit por grupo.

### Tarea 3.2: una sola versión de cada cosa

**Interfaces:**
- Produces: `createSlug(value: string): string` en `src/lib/slug.ts`; `fetchMaxicambiosRates()` en `netlify/functions/lib/maxicambios.mjs`.

- [ ] Test de `createSlug` con tildes, símbolos y espacios. Quitar las dos copias actuales.
- [ ] Unificar los tres scrapers. El navegador solo llama a `/api/cotizaciones` y usa `/cotizaciones.json` de respaldo, de modo que `axios` y `cheerio` salen del JavaScript público.
- [ ] Crear `netlify/functions/clima.mjs` para que la clave de OpenWeather quede solo en el servidor. Test: el JavaScript compilado no contiene la clave.
- [ ] Commit.

### Tarea 3.3: tipos, estilo y CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] Corregir los 146 errores de `tsc`, empezando por los que indican bugs reales.
- [ ] Aplicar Prettier en un único commit sin otros cambios.
- [ ] Resolver las 71 violaciones de hooks, en su mayoría por retornos anticipados en `admin.tsx`.
- [ ] CI en cada push: `tsc`, ESLint, `npm test` y compilación. `npm run test:db` usa un secreto de GitHub con un token nuevo.
- [ ] Actualizar `zod`, `vite` y `follow-redirects` para dejar `npm audit` sin avisos altos.
- [ ] Commit y comprobar un push en verde.

---

## Fase 4: panel en `admin.qapchaconews.com`

**Sale cuando:** el panel nuevo cubre todo lo del actual, `/admin` desaparece del sitio público y el JavaScript público no contiene código del panel.

Esta fase necesita su propia especificación y su propio plan: empieza con las skills de brainstorming e impeccable, porque el diseño visual y la experiencia de los editores merecen decidirse contigo. Estas son las decisiones de partida que propongo.

- **Estructura:** mismo repositorio, entrada `admin.html`, código en `src/admin/`, `vite.admin.config.ts` y salida `dist-admin`. Es un segundo sitio de Netlify en el subdominio, con CSP propia y `noindex`. Reutiliza `article-form.ts` y `use-article-form.ts`.
- **Acceso:** pantalla de inicio de sesión propia. Se elimina `admin-access.ts`, porque el permiso real ya lo aplica la base. Administradores con doble factor (TOTP) obligatorio y comprobado en RLS.
- **Secciones:** Resumen, Artículos, Editor, Comentarios, Categorías, Etiquetas, Usuarios, Newsletter y Control de Acceso.
- **Editor:** sustituir `contenteditable` y `execCommand` (obsoleto) por TipTap, con borrador automático, vista previa y subida de imágenes.
- **Consultas:** paginación y conteos en la base, nunca descargar todo en el navegador.

Migraciones previstas, cada una con su prueba:

- `admin_dashboard_stats()` para los números del Resumen.
- `replace_article_tags(p_article_id uuid, p_tag_ids uuid[])` para que un fallo no deje una nota sin etiquetas.
- Métricas por día, si el Resumen las necesita.
- Limpieza de archivos huérfanos en Storage.

---

## Fase 5: SEO, velocidad y accesibilidad

**Sale cuando:** al compartir una nota se ve su imagen y su título, Google recibe todas las notas, y Lighthouse móvil da 90 o más en rendimiento, accesibilidad y SEO en portada y en una nota.

### Tarea 5.1: vista previa al compartir

**Files:**
- Create: `netlify/edge-functions/article-meta.ts`
- Test: `netlify/edge-functions/article-meta.test.ts`

- [ ] Test: dado un artículo, inserta `og:title`, `og:description`, `og:image` absoluta, `canonical` y JSON-LD `NewsArticle` en el HTML, con el texto escapado.
- [ ] Test: si el artículo no existe o Supabase falla, devuelve el HTML normal sin error.
- [ ] Implementar para `/noticia/*`. Corregir la URL de imagen en [noticia.$slug.tsx:40](../../../src/routes/noticia.$slug.tsx).
- [ ] Comprobar con el agente de Facebook que aparecen las etiquetas. Commit.

### Tarea 5.2: sitemap y dominio canónico

- [ ] Crear `netlify/functions/sitemap.mjs` con portada, categorías y todas las notas publicadas, más un RSS.
- [ ] Unificar el dominio: hoy `www` redirige a `qapchaconews.com`, pero `sitemap.xml` y `robots.txt` usan `www`. Test: todas las URL del sitemap responden 200 sin redirección.
- [ ] Quitar `/admin` de `robots.txt` tras la Fase 4. Dar de alta el sitemap en Search Console. Commit.

### Tarea 5.3: velocidad y accesibilidad

- [ ] Reducir el CSS de 583 KB: cargar solo las banderas y los iconos del clima que se usan.
- [ ] Portadas en WebP con `srcset`, `loading="lazy"` y dimensiones fijas para que la página no salte.
- [ ] Revisar contraste, foco de teclado, etiquetas de formularios y uso con lector de pantalla.
- [ ] Revisar palabras bloqueadas en comentarios. Hoy se rechazan términos comunes como "perro" o "pesado".
- [ ] Medir con Lighthouse antes y después. Commit.

---

## Fase 6: operación

**Sale cuando:** una caída avisa sola, hay copias restaurables comprobadas y otra persona podría mantener el proyecto con la documentación.

- [ ] **Copias:** decidir el plan de Supabase. Ensayar una restauración completa en un proyecto aparte.
- [ ] **Pruebas:** proyecto de pruebas separado de producción, para `npm run test:e2e` tras la migración.
- [ ] **Monitoreo:** avisos de caída y captura de errores del navegador. Revisar `lovable-error-reporting.ts`.
- [ ] **Registros:** definir cuánto tiempo se guardan los accesos del panel y borrarlos con `pg_cron`.
- [ ] **Legal:** alinear Política de Privacidad, Cookies y Términos con lo que hace el sistema, y pedir revisión a un profesional.
- [ ] **Documentación:** README real con instalación, variables, migraciones, pruebas y despliegue, más una guía breve para editores. Eliminar `informe_qap_chaconews.txt` y `ADMIN-ANALISIS-Y-ROADMAP.md`, ya absorbidos aquí.
- [ ] Revisión final de seguridad de todo el proyecto.

---

## Hallazgos y dónde se resuelven

| # | Hallazgo | Estado o tarea |
|---|---|---|
| 1 | Hacerse administrador | Base nueva lista; producción en 0.2 |
| 2 | Comentar como otra persona | Base nueva lista; producción en 0.2 |
| 3 | Bloqueo y moderación en el navegador | Base nueva lista; llega con 2.5 |
| 4 | Editor que borra la nota | 1.3 |
| 5 | SEO y fecha al guardar | 1.2 |
| 6 | Programados y hora corrida | Base nueva lista; hora en 1.2 |
| 7 | Clon infiel y esquema no reconstruible | Listo; datos en 2.1 |
| 8 | `.env` versionado | Listo en `oficial`; variables en 2.4 |
| 9 | Roles visibles al público | Base nueva lista; llega con 2.5 |
| 10 | Buscador | 1.1 |
| 11 | Likes que no se guardan | Base nueva lista; llega con 2.5 |
| 12 | Analytics bloqueado | 1.6 |
| 13 | Filtro por dominio y sin login | Fase 4 |
| 14 | Control de Acceso falso | Base nueva lista; resto en 1.7 |
| 15 | Vista previa y sitemap | 5.1 y 5.2 |
| 16 | Datos de más y tope de 1000 filas | 1.5, 1.7 y Fase 4 |
| 17 | Recargas por cada like | Listo; llega con 2.5 |
| 18 | Sesión que se cuelga | 1.4 |
| 19 | Sin red de seguridad | Listo en parte; 1.8 y 3.3 |
| 20 | Código sin uso | 3.1 y 3.2 |
| Nuevo | Sin consentimiento de cookies | 1.6 |

## Decisiones pendientes del dueño

| Decisión | Recomendación | Bloquea |
|---|---|---|
| ¿Damos acceso a producción (token) o lo haces guiado? | Guiado, para no compartir otro token | 0.2 |
| ¿Sigues usando Lovable? | Desconectarlo: el proyecto ya se gestiona por Git | 2.5 y 3.1 |
| ¿Sigues usando Hostinger? | Descartarlo: el sitio ya vive en Netlify | 3.1 |
| ¿Acceso a la cuenta de Netlify? | Sí, o lo configuras guiado | 2.4 |
| ¿Mantienes el inicio con Google y Facebook? | Google sí; Facebook solo si tus usuarios lo usan | 2.4 |
| ¿Qué correo envía los mensajes del sitio? | Un servicio SMTP con el dominio propio | 2.4 |
| ¿Plan de Supabase? | Pro al entrar en producción, por copias diarias y porque el gratuito puede pausarse; confirma el precio vigente | 2.5 y Fase 6 |
