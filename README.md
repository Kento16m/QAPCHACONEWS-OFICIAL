# QAP ChacoNews

Portal de noticias del Chaco Paraguayo. React, TanStack Router y Vite en Netlify, con Supabase como base de datos, sesiones y almacenamiento. El panel de la redacción, para `admin.qapchaconews.com`, sale del mismo repositorio y se publica aparte en Hostinger.

## Desarrollo

Necesitás Node.js 22 y un archivo `.env` local (no se sube a Git) con estas variables:

| Variable | Para qué |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `OPENWEATHER_API_KEY` | Clima (solo en el servidor) |

```sh
npm install
npm run dev        # sitio, en localhost:5173
npm run dev:admin  # panel, en localhost:5174
```

## Panel

El código está en [src/admin](src/admin) y compila por separado: `npm run build:admin` deja el resultado en `dist-admin`, con su `.htaccess` para Hostinger. `npm run check:split` comprueba que el sitio público no lleve código del panel. El sistema de diseño está en [DESIGN.md](DESIGN.md).

El panel antiguo en `/admin` del sitio sigue activo hasta retirarlo, después del cambio a la base nueva.

## Pruebas

| Comando | Qué revisa | Necesita |
| --- | --- | --- |
| `npm test` | Lógica de la app y funciones | Nada |
| `npm run test:db` | Permisos y reglas de la base | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` |
| `npm run test:e2e` | El sitio completo en un navegador | `SUPABASE_ACCESS_TOKEN` |
| `npm run test:e2e:admin` | El panel completo en un navegador | `SUPABASE_ACCESS_TOKEN` |

`test:db` y las pruebas de navegador corren solo en el proyecto de pruebas: se niegan a usar un proyecto con datos reales.

## Base de datos

Las tablas salen de [supabase/migrations](supabase/migrations). La función [moderate-comment](supabase/functions/moderate-comment) revisa cada comentario con Gemini y necesita el secreto `GEMINI_API_KEY` en Supabase. Si Gemini no responde, el comentario no se publica. La función [editor-assist](supabase/functions/editor-assist) es el asistente de IA del editor y necesita `ANTHROPIC_API_KEY`.

[scripts/migrate](scripts/migrate) copia los datos del proyecto anterior: ese proyecto solo se lee y nunca puede ser el destino.
