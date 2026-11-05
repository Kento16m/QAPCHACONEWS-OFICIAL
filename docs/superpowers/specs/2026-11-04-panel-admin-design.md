# Panel de administración de QAP Chaco News

Diseño aprobable antes de construir. Producto y usuarios: [PRODUCT.md](../../../PRODUCT.md). Marco general: Fase 4 de [el plan](../plans/2026-11-04-qapchaconews-impecable.md).

## Intención

El equipo de QAP (3 administradores y 2 editores, en computadora y en oficina) pierde tiempo en todo el panel actual: escribir, encontrar, saber qué funciona y gestionar la comunidad. El dueño quiere un panel nuevo en `admin.qapchaconews.com`, muy fácil, eficiente y de diseño fascinante, con solo las funciones que aporten.

**Éxito:** abrir el panel y saber en segundos qué hacer; publicar bien una nota en menos pasos que hoy; decidir de verdad qué va en portada; ver qué se lee.

## Objetivos

1. Reemplazar por completo `/admin` del sitio público, sin perder nada de lo que hace hoy.
2. Sumar las funciones nuevas de la sección [Funciones](#funciones).
3. Que el JavaScript público no contenga código del panel.

## Fuera de alcance

- Flujos de aprobación: el Editor publica directo, por decisión del dueño.
- Permisos por sección, chat interno, pruebas A/B y publicación automática en redes.
- Conectar Google Analytics al panel y medir visitantes únicos: se cuentan lecturas, sin rastreo nuevo.
- Revisión previa de comentarios: Gemini los modera y un Administrador borra lo que haga falta.
- Redactar notas completas con IA.

## Lo que haría fallar el proyecto aunque funcione

- Que la IA publique, borre o cambie texto sin que una persona lo acepte.
- Que un fallo de IA, correo o estadísticas impida escribir o publicar.
- Que el diseño estorbe el trabajo: controles raros, navegación ingeniosa o animaciones que hagan esperar.
- Perder texto de una nota por cualquier motivo.

## Restricciones

- Hostinger solo sirve archivos: toda lógica de servidor va en Supabase (RLS, funciones SQL, Edge Functions).
- Las claves viven como secretos de Supabase, nunca en el navegador.
- La base vieja solo se lee, hasta la copia final. El trabajo se aplica al proyecto nuevo `ooswoucakxnymtdblrzd`.
- **El sitio pasa a la base nueva antes de construir el panel** (Etapa 0, decisión del dueño). Desde entonces esa base tiene datos reales: toda migración es aditiva y compatible con el panel viejo hasta la Etapa 7, y las pruebas corren en un segundo proyecto.
- Interfaz en español de Paraguay con voseo. Fechas en `America/Asuncion`.
- Accesibilidad AA y uso completo con teclado. Todo gráfico tiene su equivalente en tabla o texto.
- Prioridad de pantalla: computadora. En celular se puede revisar Hoy, resolver comentarios y despublicar; el editor funciona, sin optimizarse para el teléfono.

## Enfoques considerados

| Enfoque | A favor | En contra | Decisión |
|---|---|---|---|
| **A. App propia en el mismo repositorio**, con compilación aparte | Comparte tipos y lógica sin copiar; aísla al público del panel | Dos compilaciones | **Elegido por el dueño** |
| B. Repositorio separado | Separación aparente | Tipos y lógica duplicados que se desincronizan | Descartado |
| C. Dentro de la compilación pública | Una sola compilación | Mezcla código de administración con el del lector | Descartado |

Estructura: entrada `admin.html`, código en `src/admin/`, `vite.admin.config.ts`, salida `dist-admin`. Reutiliza `src/types/database.ts`, `article-form.ts`, `use-article-form.ts` y `slug.ts`. Mismas herramientas del sitio (React, TanStack Router y Query, Tailwind), más TipTap para el editor. *(Decisión mía.)*

## Dirección visual: moderno, en la línea de TailAdmin

**Decisión del dueño:** tras ver cinco direcciones, pidió un panel moderno similar a TailAdmin, con la captura de referencia en `referencias/referencia 1.png`. Boceto aprobado en estilo: `.impeccable/mocks/decision/moderno.html`, con acento azul.

Se construye desde cero en ese estilo: no se copia código, imágenes ni marca de la plantilla, que es un producto de terceros.

- **Estructura:** menú lateral blanco con grupos y contadores; barra superior con colapsar, búsqueda con Ctrl K, Nueva nota, modo oscuro, notificaciones y usuario; contenido en tarjetas de bordes finos y esquinas amplias.
- **Color:** acento azul `#465fff` en acciones y selección; neutros grises; verde para subidas; rojo solo para errores y acciones peligrosas. El logo de QAP identifica el panel.
- **Claro y oscuro:** se puede elegir en la barra superior, y por defecto sigue la computadora. Cada pantalla se diseña y revisa en ambos.
- **Letra:** Outfit, servida desde el propio sitio, con cifras tabulares. *(Decisión mía: es la de la referencia.)*
- **Gráficos:** área con degradado suave y pestañas de rango (12 meses, 30 días, 7 días).
- **Movimiento:** 150–250 ms, solo para comunicar cambios de estado.
- **Contraste AA en ambos modos**, incluidos los rótulos de grupo del menú, que en el boceto quedan claros de más.

## Funciones

Permisos: **A** = Administrador, **E** = Editor. Un lector no entra al panel. La base aplica el permiso real; ocultar en pantalla es solo comodidad.

| Sección | Quién | Qué hace |
|---|---|---|
| **Hoy** | A, E | Cifras, gráfico de lecturas, lo que requiere atención y notas más leídas |
| **Artículos** | A, E (solo A borra) | Lista paginada en la base, con búsqueda, filtros por estado, sección y autor, y acciones en lote |
| **Editor** | A, E | Ver abajo |
| **Portada** | A, E | Elegir y ordenar nota principal, destacadas y última hora |
| **Calendario** | A, E | Mes con lo publicado y lo programado; arrastrar una programada a otra fecha |
| **Imágenes** | A, E | Biblioteca con buscador, texto alternativo y las dos formas de carga |
| **Comentarios** | A modera, E lee | Bandeja en vivo por nota y fecha; borrar y bloquear al autor |
| **Estadísticas** | A, E | Lecturas por día, nota, sección y autor |
| **Newsletter** | A | Suscriptores y exportar CSV. Enviar queda en espera de un servicio de correo |
| **Usuarios** | A | Lista con correo, rol y bloqueo; la cuenta protegida no se puede tocar |
| **Actividad** | A | Quién hizo qué, más el control de acceso actual con sus filtros |
| **Categorías y etiquetas** | A | Crear, editar y borrar |
| **Búsqueda rápida (Ctrl+K)** | A, E | Notas, usuarios (solo A) y acciones |

### Hoy

"Requiere atención" lista solo problemas reales, cada uno con su acción: portada con huecos, última hora vencida, borradores sin tocar hace más de 7 días, programadas de las próximas 24 horas y comentarios de las últimas 24 horas. Sin problemas, lo dice en una línea.

Arriba, cuatro cifras: lecturas, notas publicadas, comentarios de 24 horas y suscriptores. Debajo, el gráfico de lecturas junto a "Requiere atención"; luego, más leídas y lecturas por sección. La comparación con el período anterior aparece cuando hay historial para calcularla: nunca se inventa. Hasta tener 3 días de datos, el gráfico explica que se completa solo.

### Editor

- TipTap, guardando HTML como hoy. Debe abrir y volver a guardar sin perder contenido las 36 notas reales, incluidas las que tienen imágenes y videos incrustados. Esto se prueba con una copia de todas.
- Pegar desde Word o Google Docs limpia el formato sobrante.
- **Imágenes por URL o desde la computadora**, en la portada de la nota y en el texto. También arrastrar y pegar.
- Guardado automático en el navegador cada pocos segundos, con recuperación tras cerrar o fallar. Al servidor se guarda con Guardar o Publicar.
- Si otra persona guardó la nota mientras tanto, avisa y deja elegir: nunca sobrescribe en silencio.
- Vista previa con los estilos reales del sitio.
- **Revisión antes de publicar:** portada, sección, resumen, SEO y texto alternativo. Avisa, pero no impide publicar, porque una noticia urgente no puede frenarse.
- **Vista previa al compartir:** cómo se verá en WhatsApp y Facebook.
- **Historial:** cada guardado en el servidor crea una versión, con las últimas 50 por nota. Se pueden comparar y restaurar, y restaurar también crea una versión.
- **Programar:** la tarea automática actual publica a la hora indicada.

### Asistente de IA

Panel lateral del editor. Sugiere títulos, resumen, SEO y etiquetas, y corrige ortografía. Cada sugerencia se acepta o se descarta por separado; la corrección muestra el cambio exacto antes de aplicarlo.

- Edge Function `editor-assist`: verifica sesión y rol, y llama a Anthropic con `ANTHROPIC_API_KEY`. Modelo configurable por `ANTHROPIC_MODEL`, por defecto `claude-opus-5-5` con esfuerzo bajo. Probado con una nota real: cerca de 1 centavo de dólar por pedido.
- Las instrucciones prohíben agregar hechos, cifras o citas. El texto de la nota se trata como datos: nunca como instrucciones.
- Tope por persona y por día, y tabla `ai_usage` con el consumo. Un Administrador ve el consumo en Actividad.
- Si falla o se alcanza el tope, muestra el motivo y el editor sigue igual.
- Los borradores se envían a Anthropic para procesarlos. El dueño lo acepta al activarla.

### Portada

Hoy la portada usa `is_featured`, marcado en 35 de 36 notas, así que no elige nada.

- Tabla `homepage_slots`: **posición 1 para la nota principal y 2 a 6 para el bloque de 5 destacadas** (`BentoGrid` en `HomeSections`). Decisión del dueño.
- "Lo más reciente" y la tira siguen por fecha, así lo nuevo aparece solo. Una nota elegida no se repite en esas listas.
- Pantalla con un esquema de la portada real: arrastrar o buscar una nota para cada lugar.
- Si un lugar está vacío o su nota dejó de estar publicada, el sitio usa lo que usa hoy. La portada nunca queda con huecos, y mientras el panel viejo siga en uso no cambia nada.
- **Última hora:** `breaking_until`, con 24 horas por defecto y editable. Al vencer, sale sola. Hoy hay 5 notas marcadas, y al menos una es del 19 de octubre.
- Requiere cambiar `src/lib/api.ts` y `HomeSections` del sitio público. El sitio lee `is_breaking` y además respeta `breaking_until` cuando existe. `is_featured` e `is_breaking` se eliminan recién en la Etapa 7, al retirar el panel viejo.

### Imágenes

Tabla `media_assets`: URL, origen (subida o enlace), ruta en Storage, texto alternativo, medidas, quién la cargó y cuándo.

- **Subida:** el navegador reduce las fotos a 1600 px de ancho y las convierte a WebP antes de subirlas. Se aceptan JPEG, PNG y WebP. Videos y GIF se suben como hoy, sin convertir.
- **Por URL:** solo `https`; comprueba que carga y guarda la dirección tal cual. *Límite aceptado: si el sitio original borra la imagen, se rompe.* Las portadas actuales en ImageKit funcionan así.
- Las portadas de las notas existentes se registran en la biblioteca.
- Antes de borrar una imagen, avisa en qué notas se usa.

### Estadísticas

- Tabla `article_views_daily (article_id, day, views)`. `incrementar_vista` suma ahí además de en `views_count`, en una sola operación.
- Se activa apenas pueda, después del cambio de la Etapa 0, para que el historial empiece cuanto antes. No hay historial anterior: las vistas totales existentes se conservan.
- Consultas resumidas en la base, nunca descargando todo al navegador.

### Newsletter

Hoy solo se guarda la lista. Los 8 suscriptores importados figuran confirmados, pero un suscriptor nuevo queda sin confirmar para siempre porque no existe ese paso.

- **En espera:** el dueño decidió no usar Resend por el momento. Lo que sigue describe el envío para cuando elija un servicio de correo. Hasta entonces, el panel muestra la lista, permite borrar y exportar, y un suscriptor nuevo sigue quedando sin confirmar.
- **Doble confirmación:** el formulario público llama a una función que envía el correo de confirmación, con límite de intentos.
- Redactar: elegir notas y una introducción, enviarse una prueba, confirmar la cantidad de destinatarios y enviar.
- Tabla `newsletter_campaigns` con estado y conteos: un reintento no duplica envíos.
- Todo correo lleva enlace de baja firmado que funciona sin iniciar sesión. Una página pública confirma la baja.
- Destinatarios: confirmados y sin baja.

### Actividad

Tabla `activity_log (actor_id, action, entity, entity_id, summary, created_at)`, escrita por triggers en la base, no por el navegador, para que nadie pueda omitirla ni falsificarla. Cubre notas (crear, publicar, despublicar, borrar), portada, comentarios borrados, roles, bloqueos, categorías y etiquetas. Solo lectura, también para Administradores.

### Acceso

- Pantalla propia con Google y correo. Se elimina `admin-access.ts`.
- **Doble verificación (TOTP) obligatoria para Administradores:** `private.is_admin()` y `private.is_staff()` exigen `aal2` cuando la cuenta es Administrador, así que sin el segundo factor no borra, ni edita, ni toca archivos. *(Decisión mía: si no, una contraseña robada podría reescribir notas.)* La base lo aplica; no solo la pantalla.
- Se activa en la **Etapa 7**, porque el panel viejo no sabe pedir el segundo factor. Hasta entonces el panel nuevo invita a inscribirse.
- El alta pide registrar dos dispositivos. Si alguien los pierde todos, el dueño borra el factor desde Supabase.
- Editores: opcional.
- Consecuencia: un Administrador que entra al sitio público sin segundo factor ya no borra comentarios desde ahí; lo hace en el panel.

### Borrar una nota

La acción principal es **Archivar**, que ya existe y se revierte. Borrar sigue siendo solo de Administrador, con confirmación, y las versiones de la nota **se conservan**: `article_revisions` guarda título y contenido sin depender de que la nota exista, y se puede restaurar desde Actividad. *(Decisión mía: evita perder texto sin agregar una papelera que toque todas las consultas públicas.)*

## Base de datos

Cada migración con su prueba en `supabase/tests/security.sql`:

`homepage_slots`, `breaking_until`, `media_assets`, `article_revisions` (por trigger, poda a 50), `article_views_daily`, `activity_log`, `ai_usage`, `newsletter_campaigns`; RPC `admin_dashboard_stats()`, `admin_list_users()` (une correo de `auth.users`, solo Administrador), `replace_article_tags()`; eliminar `is_featured` e `is_breaking` al final.

`scripts/migrate/import-prod.mjs` se usa una última vez en la Etapa 0. Reemplaza todos los datos, así que después de ese día **debe negarse a correr**: se protege con esa condición en la misma etapa.

## Etapas

Cada una se puede probar por separado. El panel viejo sigue funcionando hasta la última.

0. **Cambio a la base nueva** (Fase 2 del plan; requiere aprobación del dueño ese día): segundo proyecto para pruebas, probar el sitio y el panel viejo en una vista previa de Netlify, correo de sesión (SMTP), copia final, apuntar Netlify a `oficial`, comprobar en vivo y bloquear la migración. La base vieja se conserva 30 días como vuelta atrás. Los usuarios vuelven a iniciar sesión.
1. **Base:** compilación, entrar, doble verificación, menú y Hoy con datos reales.
2. **Escribir:** Artículos, Editor, historial y asistente de IA.
3. **Organizar:** Imágenes, Portada (con el cambio público) y Calendario.
4. **Gestionar:** Comentarios, Usuarios, Categorías y etiquetas, Actividad.
5. **Medir:** Estadísticas y las cifras completas de Hoy.
6. **Comunicar:** enviar newsletter y doble confirmación. En espera de un servicio de correo; la lista de suscriptores va en la Etapa 4.
7. **Salir:** quitar `/admin` del sitio público, retirar las columnas viejas y activar el segundo factor obligatorio.

Desde la Etapa 1 cada etapa se publica en Hostinger para que el equipo la use; el panel viejo sigue disponible hasta la Etapa 7.

## Publicación en Hostinger

`dist-admin` incluye un `.htaccess` con redirección de la app de una sola página, política de seguridad (CSP), `X-Robots-Tag: noindex` y HSTS. La primera subida es manual por hPanel. Se automatiza con GitHub Actions si el dueño entrega credenciales FTP.

## Pruebas

Lógica con Vitest escrita primero; permisos con `npm run test:db` y flujos reales con Playwright, los dos **contra el segundo proyecto de pruebas**. Después de la Etapa 0 se niegan a correr contra el proyecto con datos reales, igual que hoy con el viejo. Cada migración se aplica primero en pruebas. CI compila también el panel y comprueba que el JavaScript público no contenga su código. Revisión final de diseño y de código con revisores independientes.

## Lo que queda a criterio del constructor

Componentes internos, biblioteca de arrastre, forma exacta de las tablas no descritas, textos de la interfaz, topes numéricos de IA y límites de intentos, siempre dentro de este documento.

## Lo que necesita el dueño

- **Etapa 0:** acceso a Netlify, un token nuevo de solo lectura para la copia final, correo de sesión (SMTP) y un segundo proyecto de Supabase para pruebas.
- **Etapa 1:** acceso a Hostinger.
- **Etapa 2:** guardar `ANTHROPIC_API_KEY` en Supabase.
- **Etapa 6, cuando se retome:** elegir un servicio de correo y sus registros DNS.
