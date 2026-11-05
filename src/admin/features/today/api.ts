import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { requireSupabaseClient } from "@/lib/supabase";
import type { AttentionInput } from "../../lib/attention";
import {
  comparedToPrevious,
  fetchSeries,
  previousRange,
  rangeFor,
  totalReads,
} from "../../lib/series";

export type DashboardStats = AttentionInput & {
  published: number;
  articles_total: number;
  total_reads: number;
  comments_total: number;
  subscribers: number;
  users_total: number;
  most_read: {
    id: string;
    title: string;
    reads: number;
    published_at: string | null;
    category: string | null;
  }[];
  by_category: { id: string; name: string; reads: number; notes: number }[];
};

const fetchDashboard = async () => {
  const { data, error } = await requireSupabaseClient().rpc("admin_dashboard_stats");
  if (error) throw error;
  return data as unknown as DashboardStats;
};

export const useDashboard = () =>
  useQuery({ queryKey: ["admin", "dashboard"], queryFn: fetchDashboard, refetchInterval: 60_000 });

/** Reads of the last 7 days, and against the 7 before: a percentage, null if it cannot be compared. */
export const useReadsChange = () => {
  const range = useMemo(() => rangeFor(7), []);
  const before = useMemo(() => previousRange(range), [range]);
  const current = useQuery({
    queryKey: ["admin", "series", range.from, range.to],
    queryFn: () => fetchSeries(range.from, range.to),
  });
  const previous = useQuery({
    queryKey: ["admin", "series", before.from, before.to],
    queryFn: () => fetchSeries(before.from, before.to),
  });
  return {
    reads: current.data && totalReads(current.data),
    percent:
      current.data && previous.data ? comparedToPrevious(current.data, previous.data) : undefined,
  };
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const useCommentsBefore = () =>
  useQuery({
    queryKey: ["admin", "dashboard", "comments-before"],
    queryFn: async () => {
      const { count, error } = await requireSupabaseClient()
        .from("comments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", hoursAgo(48))
        .lt("created_at", hoursAgo(24));
      if (error) throw error;
      return count ?? 0;
    },
  }).data;
