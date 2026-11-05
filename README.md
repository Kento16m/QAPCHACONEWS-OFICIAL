# QAP ChacoNews

Portal de noticias del Chaco Paraguayo. React, TanStack Router y Vite en Netlify, con Supabase como base de datos, sesiones y almacenamiento.

## Desarrollo

Necesitás Node.js 22 y un archivo `.env` local (no se sube a Git) con estas variables:

| Variable | Para qué |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `OPENWEATHER_API_KEY` | Clima (solo en el servidor) |

```sh
npm install
npm run dev
```

## Pruebas

| Comando | Qué revisa | Necesita |
| --- | --- | --- |
| `npm test` | Lógica de la app y funciones | Nada |
| `npm run test:db` | Permisos y reglas de la base | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` |
| `npm run test:e2e` | La app completa en un navegador | `SUPABASE_ACCESS_TOKEN` |

`test:db` y `test:e2e` se niegan a correr contra el proyecto de producción.

## Base de datos

Las tablas salen de [supabase/migrations](supabase/migrations). La función [moderate-comment](supabase/functions/moderate-comment) revisa cada comentario con Gemini y necesita el secreto `GEMINI_API_KEY` en Supabase. Si Gemini no responde, el comentario no se publica.

[scripts/migrate](scripts/migrate) copia los datos del proyecto anterior: ese proyecto solo se lee y nunca puede ser el destino.
