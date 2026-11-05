# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Administradores y editores de QAP Chaco News.** Equipo chico: hoy 3 administradores y 2 editores. Escriben y publican sobre todo desde la computadora, en oficina.
- **Lectores** del sitio público: leen noticias, comentan y se suscriben al newsletter.

## Product Purpose

QAP Chaco News es un medio digital que informa, analiza y contextualiza temas de interés público, con especial atención a la actualidad del Chaco paraguayo: desarrollo regional, política, economía, medio ambiente, sociedad y tecnología.

El panel de administración existe para que ese equipo chico publique rápido y bien. Hoy les molesta todo por igual: escribir y dar formato, encontrar y organizar notas, saber qué funciona, y gestionar comunidad y usuarios. Tiene éxito si el trabajo diario pasa a ser evidente y toma menos tiempo.

## Operating Context

- Sitio público en Netlify. Panel en `admin.qapchaconews.com`, en Hostinger, que solo sirve archivos: el panel no tiene funciones de servidor propias.
- Toda la lógica de servidor vive en Supabase: base con RLS, Storage, Edge Functions.
- Los comentarios los revisa Gemini antes de publicarse.
- El contenido real incluye 36 artículos con portadas alojadas en ImageKit, 15 categorías y 13 etiquetas.

## Capabilities and Constraints

- Idioma de la interfaz: español de Paraguay, con voseo.
- Prioridad de pantalla: computadora. El celular debe servir para revisar y resolver lo urgente.
- Asistente de IA de Anthropic para escribir: sugiere y corrige, nunca publica solo, y siempre revisa una persona. No redacta notas completas por ahora.
- La clave de IA vive como secreto en Supabase, nunca en el navegador.
- El permiso real lo aplica la base. Solo los administradores borran artículos; administradores y editores pueden crear y editar.

## Brand Commitments

- Nombre: QAP Chaco News. Logos en `public/logo-light.webp` y `public/logo-dark.webp`.
- El dueño pidió un panel con diseño moderno y fascinante, muy fácil de usar y eficiente, en la línea de TailAdmin (referencia en `referencias/referencia 1.png`), con acento azul y modo claro y oscuro. Se construye desde cero, sin copiar código ni imágenes de esa plantilla.

## Evidence on Hand

Datos reales ya copiados en la base nueva. No hay cifras de audiencia históricas: solo vistas totales por artículo.

## Product Principles

- La tarea diaria va primero: lo más frecuente está a un clic.
- Una persona decide: la IA propone, nunca publica ni borra.
- Nada se pierde: borradores automáticos y acciones peligrosas con confirmación.
- Solo lo que un equipo chico usa: sin flujos pensados para grandes redacciones.
