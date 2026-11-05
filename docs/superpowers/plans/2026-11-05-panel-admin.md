# Panel de administración: plan de implementación

> **Para quien ejecute:** usar superpowers:executing-plans o superpowers:subagent-driven-development, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** pasar el sitio a la base nueva y reemplazar `/admin` por un panel propio en `admin.qapchaconews.com`.

**Arquitectura:** app React con compilación propia en el mismo repositorio (`src/admin/`, `dist-admin`), servida como archivos en Hostinger. Toda la lógica de servidor vive en Supabase. El sitio público comparte tipos y lógica de formularios, pero nunca código de pantallas.

**Tecnología:** React 19, TanStack Router y Query, Tailwind 4, Radix, lucide-react, TipTap, Outfit (`@fontsource-variable/outfit`), Supabase Auth con TOTP, Edge Functions con Deno, API de Anthropic.

**Spec:** [2026-11-04-panel-admin-design.md](../specs/2026-11-04-panel-admin-design.md). Contrato visual: `.impeccable/surfaces/admin-html.md`.

## Restricciones globales

- La base vieja `nkkgwjvmdxggvyzehlzp` solo se lee, por `/database/query/read-only`. Los tokens nunca se guardan en archivos ni commits.
- Se trabaja en `oficial` y se sube a `oficial:main`. Nada llega a lectores sin aprobación del dueño ese día.
- Tras la Etapa 0, `ooswoucakxnymtdblrzd` tiene datos reales: las migraciones son aditivas, se aplican primero en el proyecto de pruebas y el panel viejo sigue funcionando hasta la Etapa 7.
- Las pruebas de base y de navegador corren solo contra el proyecto de pruebas.
- Prueba primero, viéndola fallar. Cada migración tiene su prueba en `supabase/tests/security.sql`.
- Español de Paraguay con voseo. Fechas en `America/Asuncion`. Contraste AA en claro y oscuro, y uso completo con teclado.
- Sin dependencias nuevas salvo TipTap y la fuente. Arrastrar usa HTML nativo, siempre con una alternativa por botones.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Antes de la UI: leer `reference/craft-floor.md` de impeccable.

## Puntos de revisión

Cada uno tiene su prueba en la tarea indicada.

1. Una nota vieja con video o imagen incrustada se abre y se guarda sin perder nada (2.2).
2. Dos personas editan la misma nota: la segunda recibe un aviso y ninguna pierde texto (2.3).
3. Se corta internet al guardar: el texto sigue en el navegador y se recupera (2.3).
4. Una nota elegida en portada se despublica o se borra: el lugar se rellena solo (3.2).
5. Una lectura o una nota programada cerca de la medianoche de Paraguay cae en el día correcto (0.6 y 3.3).

---

## Etapa 0: cambio a la base nueva

### Tarea 0.1: proyecto de pruebas y protección

**Requiere:** referencia y token de "BASE DE TEST".

**Archivos:** crear `scripts/lib/test-target.mjs` y `scripts/lib/test-target.test.mjs`; modificar `scripts/test-db.mjs`, `e2e/smoke.spec.ts`, `README.md`.

**Produce:** `assertTestTarget(refOrUrl: string): void`.

- [ ] Prueba: lanza un error con `nkkgwjvmdxggvyzehlzp`, con `ooswoucakxnymtdblrzd` y con una URL que contenga cualquiera de los dos; acepta otro valor. Verla fallar e implementar.
- [ ] Usarla en `test-db.mjs` y `smoke.spec.ts` en lugar de la comprobación actual.
- [ ] Aplicar `supabase/migrations/*` y `supabase/seed.sql` al proyecto de pruebas, y desplegar `moderate-comment`. Esperado: `npm run test:db` 125/125 y Playwright 29/29 contra ese proyecto.
- [ ] Commit.

### Tarea 0.2: la copia solo puede hacerse una vez

**Archivos:** migración `cutover_lock`; modificar `scripts/migrate/transform.mjs`, su prueba e `import-prod.mjs`.

**Produce:** tabla `private.cutover (done_at timestamptz not null)`; `assertNotCutOver(rows: unknown[]): void`; opción `--lock` de `import-prod.mjs`.

- [ ] Prueba: `assertNotCutOver([])` no lanza error; con una fila lanza `/ya se hizo el cambio/`. Prueba en `security.sql`: anon y authenticated reciben `42501`.
- [ ] `import-prod.mjs` consulta la tabla antes de leer producción. `--lock` inserta la fila, no copia nada, y `truncate` no incluye esa tabla.
- [ ] Commit.

### Tarea 0.3: vista previa en Netlify

**Requiere:** acceso a Netlify. Sigue la Tarea 2.4 del [plan general](2026-11-04-qapchaconews-impecable.md).

- [ ] Sitio de pruebas desde `oficial` con la base nueva y sus variables.
- [ ] Comprobar en vivo: etiquetas de `/noticia/<slug>`, `sitemap.xml`, `rss.xml`, `/api/clima`, `/api/cotizaciones`, y que `/admin` entra, con `VITE_ADMIN_HOST` configurado.
- [ ] Lighthouse real en portada y en una nota. Registrar las cifras en el ledger.

### Tarea 0.4: correo de sesión

**Requiere:** datos SMTP del dueño. Sin Resend por ahora: sirve el correo del dominio en Hostinger.

- [ ] Configurar SMTP por `/config/auth` en el proyecto nuevo.
- [ ] Esperado: registro y recuperación de contraseña de un usuario temporal llegan a una casilla real. Borrar ese usuario.

### Tarea 0.5: el cambio

**Requiere aprobación del dueño ese mismo día.** Sigue la Tarea 2.5 del plan general.

- [ ] Avisar al equipo y congelar publicaciones.
- [ ] `import-prod.mjs` con el token nuevo de solo lectura. Esperado: "Migración completa y verificada".
- [ ] Apuntar el sitio de producción de Netlify a `oficial`.
- [ ] En vivo: portada, una nota, entrar con Google, comentar y publicar desde `/admin`.
- [ ] `import-prod.mjs --lock`. Comprobar que una nueva copia se niega a correr.
- [ ] **Vuelta atrás:** restaurar el despliegue anterior en Netlify. La base vieja se conserva 30 días.

### Tarea 0.6: empezar a contar lecturas

Va inmediatamente después del cambio.

**Archivos:** migración `article_views_daily`.

**Produce:** tabla `article_views_daily (article_id uuid references articles on delete cascade, day date, views int, primary key (article_id, day))`, lectura solo para staff.

- [ ] Pruebas en `security.sql`: una vista suma en ambos lados; en borrador no suma nada; `2026-11-05 02:30 UTC` cuenta como el día `2026-11-04`; anon no lee la tabla.
- [ ] `incrementar_vista` hace las dos cosas en una sola sentencia, con el día en `America/Asuncion`. El contrato público no cambia.
- [ ] Aplicar en pruebas y luego en el proyecto real. Commit.

---

## Etapa 1: base del panel

### Tarea 1.1: compilación propia

**Archivos:** crear `admin.html`, `vite.admin.config.ts`, `src/admin/main.tsx`, `src/admin/theme.css`, `src/admin/routes/__root.tsx`, `src/admin/public/.htaccess`, `src/admin/public/robots.txt`, `scripts/check-admin-split.mjs`; modificar `package.json`, `.github/workflows/ci.yml`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`.

**Produce:** `npm run dev:admin` (puerto 5174), `npm run build:admin` (`dist-admin`), tokens de tema, rutas por archivos en `src/admin/routes`.

- [ ] Prueba: `check-admin-split.mjs` falla si algún archivo de `dist` contiene `Requiere atención`, o si falta `.htaccess` en `dist-admin`. Verla fallar y crear lo necesario.
- [ ] `.htaccess`: redirección de la app a `index.html`, CSP (`connect-src` con `https://*.supabase.co wss://*.supabase.co`, `img-src https: data: blob:`, y los mismos `frame-src` de `netlify.toml`), `X-Robots-Tag: noindex`, HSTS, caché larga en `assets/`.
- [ ] `theme.css`: tokens claros y oscuros con los valores del contrato, y estados hover, focus, active, disabled, error, éxito y aviso.
- [ ] CI: compilar también el panel y correr `check-admin-split`. Commit.

### Tarea 1.2: entrar y doble verificación

**Archivos:** crear `src/admin/lib/access.ts` y su prueba, `src/admin/routes/entrar.tsx`, `src/admin/features/auth/*`.

**Produce:**

```ts
type PanelAccess = "signin" | "denied" | "blocked" | "enroll" | "verify" | "ok";
panelAccess(input: {
  hasSession: boolean;
  role: "reader" | "editor" | "admin" | null;
  isBlocked: boolean;
  aal: "aal1" | "aal2";
  factorCount: number;
  requireMfa: boolean;
}): PanelAccess;
```

- [ ] Prueba de tabla: sin sesión da `signin`; lector, `denied`; bloqueado, `blocked`; editor sin factor, `ok`; admin sin factor y `requireMfa`, `enroll`; admin con factor en `aal1`, `verify`; admin en `aal2`, `ok`; admin sin factor y sin `requireMfa`, `ok`.
- [ ] Pantallas: Google y correo; alta TOTP con QR y dos dispositivos; pedir el código. `requireMfa` sale de `VITE_ADMIN_REQUIRE_MFA` y queda en `false` hasta la Etapa 7. Mientras tanto, un aviso invita a inscribirse.
- [ ] Registrar el acceso con la función actual de `src/lib/admin.ts`, `recordAdminAccessLog`.
- [ ] Playwright: lector ve "sin acceso"; editor entra; admin se inscribe, sale y debe dar el código. Commit.

### Tarea 1.3: marco de la app

**Archivos:** crear `src/admin/layout/{Sidebar,TopBar,AppLayout}.tsx`, `src/admin/lib/theme.ts` y su prueba, `src/admin/lib/nav.ts` y su prueba, y `src/admin/ui/*`.

**Produce:** `navFor(role): NavGroup[]`; `resolveTheme(saved: "light" | "dark" | "system" | null, systemDark: boolean): "light" | "dark"`, guardado en `qap_admin_theme`.

- [ ] Pruebas: `navFor("editor")` no incluye Usuarios, Newsletter, Actividad ni Categorías; `navFor("admin")` incluye todo. `resolveTheme` respeta lo guardado y, si no hay nada, sigue al sistema.
- [ ] Menú con los grupos del boceto, colapsable y como panel deslizable en celular. Barra superior según el contrato. La campana lista lo que requiere atención.
- [ ] Commit.

### Tarea 1.4: pantalla Hoy

**Archivos:** migración `admin_dashboard_stats`; crear `src/admin/routes/index.tsx`, `src/admin/features/today/*`, `src/admin/lib/attention.ts` y su prueba.

**Produce:** RPC `admin_dashboard_stats() returns jsonb`, solo staff; `attentionItems(stats): AttentionItem[]`.

- [ ] `security.sql`: anon y lector reciben error; editor recibe datos.
- [ ] Prueba de `attentionItems`: genera cada uno de los avisos del spec solo cuando corresponde, y una lista vacía cuando no hay problemas. La pantalla lo dice en una línea.
- [ ] Cifras, atención y más leídas con datos reales, con esqueletos de carga. El gráfico explica que se completa solo; se termina en la Tarea 5.1.
- [ ] Capturas a 1440 y 390 px, en claro y oscuro. Corregir lo que se vea mal. Commit.

### Tarea 1.5: primera publicación

**Requiere:** acceso a Hostinger y subdominio `admin` creado.

- [ ] Subir `dist-admin` por hPanel. Esperado: entrar con Google en `https://admin.qapchaconews.com`, recargar en una ruta interna sin error 404, y `curl -I` muestra CSP y `noindex`.

---

## Etapa 2: escribir

### Tarea 2.1: lista de artículos

**Archivos:** migración `replace_article_tags`; crear `src/admin/lib/articles.ts` y su prueba, `src/admin/routes/articulos.index.tsx`, `src/admin/features/articles/*`.

**Produce:** `listArticles(filters: { page: number; q?: string; status?: ArticleStatus; categoryId?: string; authorId?: string }): Promise<{ rows: AdminArticle[]; total: number }>` con 25 filas por página y conteo en la base; RPC `replace_article_tags(p_article_id uuid, p_tag_ids uuid[])`, en una transacción.

- [ ] Pruebas: los filtros arman la consulta correcta, reutilizando `buildSearchFilter`; el RPC es solo para staff y un error no deja la nota sin etiquetas.
- [ ] Filtros guardados en la URL. Acciones en lote: publicar, archivar y, solo admin, borrar con confirmación.
- [ ] Commit.

### Tarea 2.2: editor de texto

**Archivos:** crear `src/admin/editor/{RichEditor.tsx,extensions.ts,paste.ts,paste.test.ts,roundtrip.test.ts}`, `scripts/check-editor-roundtrip.mjs`.

**Produce:** `<RichEditor value onChange />`; `cleanPastedHtml(html: string): string`; `roundtrip(html: string): string`.

- [ ] Prueba: `roundtrip` conserva títulos, listas, citas, enlaces, tablas, imágenes con `alt`, y `iframe` de los servicios permitidos por `netlify.toml`; elimina `script`, `on*` e `iframe` de otros sitios. `cleanPastedHtml` quita `mso-*`, `style`, `class` y comentarios condicionales de una muestra de Word.
- [ ] `check-editor-roundtrip.mjs`: lee por la API pública todas las notas publicadas y compara texto, cantidad de imágenes y de `iframe`. Esperado: 36 sin diferencias. Lo que no coincida se resuelve con una extensión, nunca aceptando la pérdida.
- [ ] Commit.

### Tarea 2.3: pantalla de la nota

**Archivos:** crear `src/admin/routes/articulos.$id.tsx`, `src/admin/features/editor/*`, `src/admin/lib/save-article.ts`, `src/admin/lib/pre-publish.ts` y sus pruebas.

**Consume:** `useArticleForm`, `buildArticlePayload`, `createSlug`.

**Produce:** `saveArticle(id: string | null, payload: ArticlePayload, expectedUpdatedAt: string | null): Promise<AdminArticle>`, que lanza `ArticleConflictError` si `updated_at` cambió; `prePublishIssues(form: EditorForm): Issue[]`.

- [ ] Pruebas: el guardado filtra por `updated_at`, y cero filas producen `ArticleConflictError`; `prePublishIssues` avisa por portada, sección, resumen, SEO e imágenes sin `alt` del texto, y nunca impide publicar.
- [ ] Playwright (puntos 2 y 3): al cambiar `updated_at` por detrás, aparece el aviso con las opciones de ver lo del otro o sobrescribir, y el texto sigue; con la red cortada, Guardar muestra error y al recargar se ofrece el borrador.
- [ ] Vista previa con los estilos reales de la nota, vista previa de WhatsApp y Facebook con las mismas reglas de `netlify/shared/article-meta.mjs`, programar y archivar.
- [ ] Commit.

### Tarea 2.4: historial de versiones

**Archivos:** migración `article_revisions`; crear `src/admin/lib/word-diff.ts` y su prueba, `src/admin/features/editor/History.tsx`.

**Produce:** tabla `article_revisions` sin clave foránea a `articles`, con el contenido y `edited_by`; triggers antes de actualizar campos de contenido y antes de borrar, con poda a 50 por nota; RPC `admin_restore_article(p_revision_id bigint) returns uuid`, solo admin; `wordDiff(a, b): DiffPart[]`.

- [ ] `security.sql`: editar crea una versión; cambiar `views_count` no; la número 51 borra la más vieja; borrar la nota conserva sus versiones; el RPC recrea una nota borrada; anon no lee nada.
- [ ] Comparar y restaurar en el editor. Restaurar usa `saveArticle`, así crea otra versión.
- [ ] Commit.

### Tarea 2.5: asistente de IA

**Antes de escribir código:** cargar la skill `claude-api` y confirmar modelo, precio y forma de la salida estructurada.

**Archivos:** migración `ai_usage`; crear `supabase/functions/editor-assist/{index.ts,assist.ts,assist.test.ts}`, `src/admin/features/editor/AiPanel.tsx`, `src/admin/lib/apply-fix.ts` y su prueba.

**Produce:** función con `action` en `titles | summary | seo | tags | proofread`; `runAssist(action, article, apiKey, http, model): Promise<AssistResult>`; RPC `service_reserve_ai_use(p_user_id uuid)`, que aplica los topes de 100 usos por persona y 500 en total por día, en `America/Asuncion`; `applyFix(doc, original, replacement): "applied" | "gone"`.

- [ ] Pruebas con `http` simulado, como en `moderation.test.ts`: respuesta malformada, error y tiempo agotado devuelven un error claro; el texto de la nota va separado de las instrucciones; las etiquetas sugeridas se separan en existentes y nuevas. La función exige sesión de staff y no acepta `user_id` del cuerpo.
- [ ] `security.sql`: el tope 101 falla con `QC429`; solo `service_role` ejecuta el RPC.
- [ ] Panel: cada sugerencia se acepta o se descarta; la corrección muestra el cambio exacto, y `applyFix` no toca nada si el texto ya cambió. Un fallo nunca bloquea el editor.
- [ ] Desplegar en el proyecto real y probar las cinco acciones con una nota real, sin guardar. Commit.

---

## Etapa 3: organizar

### Tarea 3.1: imágenes

**Archivos:** migración `media_assets`, que registra las portadas actuales; crear `src/admin/routes/imagenes.tsx`, `src/admin/features/media/*`, `src/admin/lib/media.ts` y su prueba.

**Produce:** `compressImage(file: File): Promise<File>`, a 1600 px y WebP; `validateImageUrl(url: string): boolean`, solo `https`; `imageUsage(url: string): Promise<{ id: string; title: string }[]>`; `<ImagePicker onPick />` con pestañas Biblioteca, Subir y URL.

- [ ] Pruebas: rechaza `http:`, `javascript:` y `data:`; un video o GIF no se convierte y sí se sube; una imagen más chica no se agranda.
- [ ] `security.sql`: administradores y editores leen, cargan y borran cualquier imagen, igual que hoy en Storage; anon y lector no pueden.
- [ ] El selector se usa en portada de la nota y en el texto, con arrastrar y pegar. Antes de borrar, se muestra `imageUsage`.
- [ ] Commit.

### Tarea 3.2: control de portada

**Archivos:** migración `homepage_slots`; modificar `src/lib/api.ts`, `src/components/news/HomeSections.tsx`, `src/components/news/Ticker.tsx` y sus pruebas; crear `src/lib/homepage.ts` y su prueba, `src/admin/routes/portada.tsx`, `src/admin/features/homepage/*`.

**Produce:** tabla `homepage_slots (position int check (position between 1 and 6) primary key, article_id uuid references articles on delete set null)`, lectura pública y escritura de staff; `articles.breaking_until timestamptz`; `composeHomepage(slots: Article[], featuredFallback: Article | null, latest: Article[]): { hero: Article | null; featured: Article[]; strip: Article[]; latest: Article[] }`.

- [ ] Prueba (punto 4): sin lugares elegidos da exactamente lo que muestra hoy; la nota elegida no se repite; un lugar vacío o despublicado se rellena con la más reciente; con pocas notas, nada falla.
- [ ] `security.sql`: anon lee, lector no escribe y editor sí; `on delete` deja el lugar vacío.
- [ ] Última hora: el sitio muestra `is_breaking` si `breaking_until` es nulo o futuro. El panel lo fija a 24 horas por defecto, editable.
- [ ] Pantalla con el esquema de la portada: arrastrar, buscar, y botones subir y bajar. Playwright: elegir una nota y verla en la portada pública.
- [ ] Commit. **Sale al sitio público solo con aprobación del dueño.**

### Tarea 3.3: calendario

**Archivos:** crear `src/admin/routes/calendario.tsx`, `src/admin/features/calendar/*`, `src/admin/lib/calendar.ts` y su prueba.

**Produce:** `monthGrid(year: number, month: number): Date[][]`; `canMove(article, target: Date, now: Date): boolean`; `listCalendar(from: string, to: string)`.

- [ ] Prueba (punto 5): una nota del `2026-11-05 02:30 UTC` aparece el 4 de noviembre; `canMove` solo acepta programadas y una fecha futura; conserva la hora al cambiar de día.
- [ ] Mes con publicadas y programadas; arrastrar, o elegir fecha con teclado.
- [ ] Commit.

---

## Etapa 4: gestionar

### Tarea 4.1: comentarios

**Archivos:** crear `src/admin/routes/comentarios.tsx`, `src/admin/features/comments/*`.

- [ ] Bandeja paginada en vivo por Realtime, con filtros por nota y fecha. Admin borra y bloquea al autor; el editor solo lee, con las acciones ocultas.
- [ ] Playwright: un comentario nuevo aparece sin recargar; un editor no ve las acciones y la base rechaza el borrado. Commit.

### Tarea 4.2: usuarios, categorías, etiquetas y newsletter

**Archivos:** migración `admin_list_users`; crear `src/admin/routes/{usuarios,categorias,newsletter}.tsx`, `src/admin/features/{users,taxonomy,newsletter}/*`, `src/admin/lib/csv.ts` y su prueba.

**Produce:** RPC `admin_list_users(p_page int, p_q text) returns table (...)` con correo, solo admin; `toCsv(rows): string`.

- [ ] `security.sql`: editor y lector reciben error en el RPC.
- [ ] Prueba de `toCsv`: comillas, saltos de línea, y un valor que empieza con `=`, `+`, `-` o `@` se neutraliza.
- [ ] Rol y bloqueo con los RPC actuales; la cuenta protegida muestra su estado, sin acciones. Bloquear ofrece cerrar sus sesiones, como hoy.
- [ ] Newsletter: lista, confirmado o no, borrar y exportar CSV. El envío queda fuera: ver Etapa 6.
- [ ] Commit.

### Tarea 4.3: actividad

**Archivos:** migración `activity_log`; crear `src/admin/routes/actividad.tsx`, `src/admin/features/activity/*`.

**Produce:** tabla `activity_log` escrita solo por triggers.

- [ ] `security.sql`: publicar, despublicar, borrar nota, cambiar portada, borrar comentario, cambiar rol, bloquear y tocar categorías dejan una fila con actor; admin lee, editor no; nadie escribe ni borra por la API.
- [ ] Pestañas Actividad y Control de acceso, con los filtros actuales: búsqueda, estado, rol, fecha y dispositivo. Restaurar una nota borrada desde aquí. Consumo de IA para el admin.
- [ ] Commit.

### Tarea 4.4: búsqueda rápida

**Archivos:** crear `src/admin/features/palette/*`, `src/admin/lib/palette.ts` y su prueba.

**Produce:** `paletteResults(q, role, notes, users): PaletteItem[]`.

- [ ] Prueba: un editor nunca recibe usuarios ni acciones de admin; las acciones aparecen por coincidencia sin tildes.
- [ ] Ctrl K abre el diálogo y se maneja por completo con teclado. Commit.

---

## Etapa 5: medir

### Tarea 5.1: estadísticas

**Archivos:** migración `admin_reads`; crear `src/admin/routes/estadisticas.tsx`, `src/admin/ui/AreaChart.tsx`, `src/admin/lib/series.ts` y su prueba; modificar Hoy.

**Produce:** RPC `admin_reads_series(p_from date, p_to date)`, `admin_reads_by(p_dimension text, p_from date, p_to date)`, para `article`, `category` y `author`, solo staff; `fillMissingDays(rows, from, to)`; `deltaPercent(current, previous): number | null`.

- [ ] Pruebas: los días sin lecturas aparecen en cero; `deltaPercent` da `null` sin período anterior o con cero, y la pantalla no muestra comparación.
- [ ] Gráfico SVG propio con pestañas 12 meses, 30 días y 7 días, y tabla equivalente. Sin dependencia nueva.
- [ ] Cifras y gráfico finales en Hoy. Con menos de 3 días, el mensaje del spec. Commit.

---

## Etapa 6: enviar newsletter (en espera)

**No se construye por ahora:** el dueño decidió no usar Resend, y enviar requiere un servicio de correo. Cuando elija uno se planifica según la sección Newsletter del spec. Hasta entonces, un suscriptor nuevo sigue quedando sin confirmar.

---

## Etapa 7: salir

### Tarea 7.1: retirar lo viejo y exigir el segundo factor

**Requiere aprobación del dueño, y que todos los administradores tengan dos dispositivos registrados.**

**Archivos:** eliminar `src/routes/admin.tsx`, `src/lib/admin-access.ts`, `src/lib/admin.ts` tras mover lo que siga en uso a `src/admin/lib/`; migración `retire_old_panel`; modificar `public/robots.txt`, `src/lib/api.ts`, `src/types/database.ts`.

- [ ] `security.sql`, en rojo primero: un admin en `aal1` no borra, no edita ni sube archivos; en `aal2` sí; un editor en `aal1` sigue trabajando.
- [ ] `private.is_admin()` y `private.is_staff()` exigen `aal2` para Administradores. Quitar `is_featured` e `is_breaking`, dejando solo `breaking_until`. Regenerar tipos.
- [ ] `VITE_ADMIN_REQUIRE_MFA=true`. `/admin` en el sitio público lleva a `admin.qapchaconews.com`, y `check-admin-split` confirma que no queda código.
- [ ] Toda la verificación: tsc, ESLint, Vitest, `test:db`, Playwright, compilar ambos.
- [ ] En vivo: entrar con segundo factor, publicar, y comprobar el sitio público. Commit.

### Tarea 7.2: revisión final y documentación

- [ ] `impeccable detect --json` sobre `src/admin`. Capturas de cada pantalla a 1440 y 390 px, en claro y oscuro.
- [ ] Revisor de diseño de impeccable (`impeccable-finish-reviewer`) con el contrato y la referencia, y revisor independiente del código de toda la rama.
- [ ] Documentador de impeccable: `DESIGN.md` y `.impeccable/design.json`.
- [ ] Actualizar `README.md` y la Fase 4 del plan general. Reportar decisiones y menores pendientes.
