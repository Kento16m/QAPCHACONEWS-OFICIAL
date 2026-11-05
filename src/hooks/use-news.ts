import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

export function useDebouncedValue<T>(value: T, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
}

export const useHomepage = () => useQuery({ queryKey: ["homepage"], queryFn: api.getHomepage });
export const useLatestArticles = (limit = 6) =>
  useQuery({ queryKey: ["latest", limit], queryFn: () => api.getLatestArticles(limit) });
export const useBreakingArticles = () =>
  useQuery({ queryKey: ["breaking"], queryFn: api.getBreakingArticles });
export const useMostRead = (limit = 5) =>
  useQuery({ queryKey: ["most-read", limit], queryFn: () => api.getMostReadArticles(limit) });
export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: api.getCategories });
export const useArticlesByCategory = (slug: string, page = 1, pageSize = 4) =>
  useQuery({
    queryKey: ["category", slug, page, pageSize],
    queryFn: () => api.getArticlesByCategory(slug, page, pageSize),
  });
export const useArticlesByTag = (slug: string, page = 1) =>
  useQuery({ queryKey: ["tag", slug, page], queryFn: () => api.getArticlesByTag(slug, page) });
export const useArticle = (slug: string) =>
  useQuery({ queryKey: ["article", slug], queryFn: () => api.getArticleBySlug(slug) });
export const useRelated = (id?: string, categoryId?: string | null) =>
  useQuery({
    queryKey: ["related", id],
    queryFn: () => api.getRelatedArticles(id!, categoryId ?? null),
    enabled: !!id,
  });
export const useSearch = (term: string, page = 1) => {
  const debouncedTerm = useDebouncedValue(term, 400);

  return useQuery({
    queryKey: ["search", debouncedTerm, page],
    queryFn: () => api.searchArticles(debouncedTerm, page),
    staleTime: 30_000,
  });
};
export const useSubscribe = () => useMutation({ mutationFn: api.subscribeNewsletter });
