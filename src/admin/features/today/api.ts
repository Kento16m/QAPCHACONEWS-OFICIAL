import { useQuery } from "@tanstack/react-query";
import { requireSupabaseClient } from "@/lib/supabase";
import type { AttentionInput } from "../../lib/attention";

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
