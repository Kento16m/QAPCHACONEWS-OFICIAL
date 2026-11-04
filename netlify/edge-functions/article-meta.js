import { handleArticleRequest } from "../shared/article-meta.mjs";

export default (request, context) =>
  handleArticleRequest(request, () => context.next(), {
    site: "https://qapchaconews.com",
    supabaseUrl: Netlify.env.get("VITE_SUPABASE_URL"),
    anonKey: Netlify.env.get("VITE_SUPABASE_ANON_KEY"),
  });

export const config = { path: "/noticia/*" };
