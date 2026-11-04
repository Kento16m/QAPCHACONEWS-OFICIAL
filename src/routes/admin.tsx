import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Download,
  FileImage,
  ImageUp,
  LayoutDashboard,
  Mail,
  Monitor,
  Newspaper,
  PlusCircle,
  Printer,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { trackArticlePublished } from "@/lib/analytics";
import { useArticleForm } from "@/hooks/use-article-form";
import { buildArticlePayload, isNewlyPublished } from "@/lib/article-form";
import { createSlug } from "@/lib/slug";

import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/use-news";
import { isAdminHostAllowed } from "@/lib/admin-access";
import { isProtectedAdminEmail } from "@/lib/admin";
import { getProfileColor } from "@/lib/profile-colors";
import { requireSupabaseClient } from "@/lib/supabase";
import { CurrencyTicker } from "@/components/news/SiteHeader";
import {
  type AdminArticle,
  createArticle,
  createCategory,
  createTag,
  deleteArticle,
  deleteCategory,
  deleteCommentForAdmin,
  deleteTag,
  getAdminArticles,
  getAdminAccessLogs,
  getArticleCommentsForAdmin,
  getArticleTagIds,
  syncArticleTags,
  updateAuthorRole,
  getAdminAuthors,
  getAdminCategories,
  getAdminTags,
  getAdminNewsletterSubscribers,
  recordAdminAccessLog,
  updateUserAccess,
  updateArticle,
  updateCategory,
  updateTag,
  uploadArticleCover,
  uploadArticleMedia,
} from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return;
    }

    const hostname = window.location.hostname;
    const isLocalDevAccess =
      (import.meta.env.DEV && ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)) ||
      hostname.endsWith(".localhost");

    const client = requireSupabaseClient();
    const {
      data: { session },
      error,
    } = await client.auth.getSession();

    if (error || !session?.user) {
      if (!isLocalDevAccess && !isAdminHostAllowed(hostname)) {
        throw notFound();
      }
      return;
    }

    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    const isProtectedMasterAdmin = isProtectedAdminEmail(session.user.email);
    const hasAdminAccess =
      profile?.role === "admin" || profile?.role === "editor" || isProtectedMasterAdmin;

    if (hasAdminAccess) {
      return;
    }

    if (!isLocalDevAccess && !isAdminHostAllowed(hostname)) {
      throw notFound();
    }
  },
  component: AdminPage,
});

const getInitials = (name: string | null | undefined) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

const formatAccessStatus = (status: string | null | undefined) => {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "success" || normalized === "ok" || normalized === "successful")
    return "Exitoso";
  if (normalized === "failure" || normalized === "failed" || normalized === "error")
    return "Fallido";
  if (normalized === "pending") return "Pendiente";

  return status ? status : "Desconocido";
};

const getDeviceTypeFromUserAgent = (userAgent?: string | null) => {
  if (!userAgent) return "Desktop";

  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
    if (/ipad|tablet/i.test(userAgent)) return "Tablet";
    return "Mobile";
  }

  if (/tablet|playbook|silk/i.test(userAgent)) return "Tablet";

  return "Desktop";
};

const getDeviceIconForType = (deviceType: string) => {
  switch (deviceType) {
    case "Mobile":
      return Smartphone;
    case "Tablet":
      return Tablet;
    default:
      return Monitor;
  }
};

const resolveAccessIpFallback = (ipAddress: string | null | undefined, userId?: string | null) => {
  if (ipAddress) return ipAddress;

  if (typeof document !== "undefined") {
    const referrer = document.referrer || "";
    if (referrer) return `referrer:${referrer}`;
  }

  if (userId) return `auth:${userId.slice(0, 8)}`;

  return "No disponible";
};

const matchesAccessDateRange = (
  value: string | null | undefined,
  range: "all" | "today" | "yesterday" | "last7" | "last30" | "thisMonth",
) => {
  if (!value || range === "all") return true;

  const date = new Date(value);
  const now = new Date();
  const toStartOfDay = (nextDate: Date) => {
    const copy = new Date(nextDate);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const todayStart = toStartOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (range) {
    case "today":
      return date >= todayStart;
    case "yesterday": {
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      return date >= toStartOfDay(yesterdayEnd) && date < todayStart;
    }
    case "last7":
      return date >= new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    case "last30":
      return date >= new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
    case "thisMonth":
      return date >= currentMonthStart;
    default:
      return true;
  }
};

function RichTextToolbar({
  onFormat,
  onInsertImage,
  onInsertVideo,
  onUploadMedia,
}: {
  onFormat: (format: "bold" | "italic") => void;
  onInsertImage: () => void;
  onInsertVideo: () => void;
  onUploadMedia: () => void;
}) {
  const buttons = [
    { key: "bold", label: "B", title: "Negrita" },
    { key: "italic", label: "I", title: "Cursiva" },
  ] as const;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-input bg-background p-2">
      {buttons.map(({ key, label, title }) => (
        <button
          key={key}
          type="button"
          title={title}
          onClick={() => onFormat(key)}
          className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={onInsertImage}
        className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
      >
        + Imagen
      </button>
      <button
        type="button"
        onClick={onInsertVideo}
        className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
      >
        + Video
      </button>
      <button
        type="button"
        onClick={onUploadMedia}
        className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
      >
        + Subir media
      </button>
    </div>
  );
}

function UserAvatar({
  name,
  avatarUrl,
  sizeClass = "h-11 w-11",
  textClass = "text-xs",
  fallbackBg = "bg-primary/10 text-primary",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  sizeClass?: string;
  textClass?: string;
  fallbackBg?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const profileColor = getProfileColor(name);

  return (
    <div
      className={`grid ${sizeClass} place-items-center overflow-hidden rounded-full border border-border ${imageFailed ? "" : "bg-background"}`}
      style={imageFailed ? { backgroundColor: profileColor, color: "#fff" } : undefined}
    >
      {!imageFailed && avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name ?? "Usuario"}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={`font-black ${textClass} ${fallbackBg}`}
          style={{ backgroundColor: profileColor, color: "#fff" }}
        >
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}

function AdminPage() {
  const { profile, loading, user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();

  const blockedAccountMessage = profile?.is_blocked
    ? profile.blocked_reason?.trim() || "Tu cuenta fue suspendida por el administrador."
    : null;

  if (blockedAccountMessage) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-[0_18px_44px_rgba(127,29,29,0.12)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-600">
            Acceso restringido
          </p>
          <h1 className="mt-3 text-3xl font-black text-red-900">Usuario suspendido</h1>
          <p className="mt-4 text-base leading-7 text-red-800">{blockedAccountMessage}</p>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              window.location.href = "/";
            }}
            className="mt-6 inline-flex items-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const isMasterAdmin = isProtectedAdminEmail(user?.email);
  const canAccess = Boolean(
    user && (profile?.role === "admin" || profile?.role === "editor" || isMasterAdmin),
  );
  const isAdminUser = Boolean(profile?.role === "admin" || isMasterAdmin);
  const isEditorUser = profile?.role === "editor";

  const {
    data: articles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "articles"],
    queryFn: getAdminArticles,
    enabled: canAccess,
  });

  const { data: authors = [] } = useQuery({
    queryKey: ["admin", "authors"],
    queryFn: getAdminAuthors,
    enabled: canAccess,
  });

  const { data: adminCategories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: getAdminCategories,
    enabled: canAccess,
  });

  const { data: adminTags = [] } = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: getAdminTags,
    enabled: canAccess,
  });

  const { data: newsletterSubscribers = [] } = useQuery({
    queryKey: ["admin", "newsletter-subscribers"],
    queryFn: getAdminNewsletterSubscribers,
    enabled: canAccess,
  });

  const { data: adminAccessLogs = [] } = useQuery({
    queryKey: ["admin", "access-logs"],
    queryFn: getAdminAccessLogs,
    enabled: canAccess && isAdminUser,
  });

  const { data: adminCommentSummary = [] } = useQuery({
    queryKey: ["admin", "comments-summary"],
    queryFn: async () => {
      const client = requireSupabaseClient();
      const { data, error } = await client.from("comments").select("id, article_id, like_count");
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: Number(row.id),
        article_id: String(row.article_id),
        like_count: Number(row.like_count ?? 0),
      }));
    },
    enabled: canAccess,
  });

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "articles"
    | "new"
    | "management"
    | "general"
    | "categories"
    | "tags"
    | "authors"
    | "users"
    | "newsletter"
    | "access-control"
  >(() => (isEditorUser ? "new" : "overview"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [managementArticleId, setManagementArticleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminArticle["status"]>("all");
  const [authorSearchTerm, setAuthorSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [newsletterSearchTerm, setNewsletterSearchTerm] = useState("");
  const [accessSearchTerm, setAccessSearchTerm] = useState("");
  const [accessStatusFilter, setAccessStatusFilter] = useState<"all" | "success" | "failure">(
    "all",
  );
  const [accessRoleFilter, setAccessRoleFilter] = useState<"all" | string>("all");
  const [accessDateFilter, setAccessDateFilter] = useState<
    "all" | "today" | "yesterday" | "last7" | "last30" | "thisMonth"
  >("all");
  const [accessVisibleCount, setAccessVisibleCount] = useState(10);
  const [selectedAccessLogId, setSelectedAccessLogId] = useState<number | null>(null);
  const accessTableRef = useRef<HTMLDivElement | null>(null);
  const [accessBanReason, setAccessBanReason] = useState("");
  const [accessBanCloseSessions, setAccessBanCloseSessions] = useState(true);
  const [showAccessBanModal, setShowAccessBanModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    color: "#E33A2E",
    sort_order: 0,
  });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [tagForm, setTagForm] = useState({ name: "", slug: "" });
  const [isCoverDragging, setIsCoverDragging] = useState(false);
  const [coverGallery, setCoverGallery] = useState<string[]>([]);
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentEditorRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const contentSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const filteredArticles = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesSearch =
        !normalized ||
        [article.title, article.slug, article.category?.name, article.author?.full_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      const matchesStatus = statusFilter === "all" || article.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [articles, searchTerm, statusFilter]);

  const selectedArticle = useMemo(
    () => (selectedId ? (articles.find((article) => article.id === selectedId) ?? null) : null),
    [articles, selectedId],
  );

  const { form, setForm, clearDraft, reset: resetForm, hasRestoredDraft } = useArticleForm(selectedArticle, getArticleTagIds);

  const selectedManagementArticle = useMemo(
    () =>
      managementArticleId
        ? (articles.find((article) => article.id === managementArticleId) ?? null)
        : null,
    [articles, managementArticleId],
  );

  const currentEditorialUser = useMemo(() => {
    const currentId = user?.id ?? profile?.id ?? null;
    const currentName = profile?.full_name || user?.full_name || user?.email || "Administrador";
    return {
      id: currentId,
      name: currentName,
    };
  }, [profile, user]);

  const editorialAuthors = useMemo(
    () => authors.filter((author) => author.role === "admin" || author.role === "editor"),
    [authors],
  );

  const lockedAuthor = useMemo(() => {
    const explicit = form.author_id ? authors.find((author) => author.id === form.author_id) : null;
    if (explicit) return explicit;
    if (currentEditorialUser.id) {
      return authors.find((author) => author.id === currentEditorialUser.id) ?? null;
    }
    return editorialAuthors[0] ?? null;
  }, [authors, currentEditorialUser.id, editorialAuthors, form.author_id]);

  const authorGroups = useMemo(() => {
    const normalizedQuery = authorSearchTerm.trim().toLowerCase();
    const matchesSearch = (author: (typeof authors)[number]) => {
      if (!normalizedQuery) return true;

      const haystack = [author.full_name, author.role, author.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    };

    const editorial = authors.filter(
      (author) => (author.role === "admin" || author.role === "editor") && matchesSearch(author),
    );
    const readers = authors.filter((author) => author.role === "reader" && matchesSearch(author));

    return {
      editorial,
      readers,
    };
  }, [authors, authorSearchTerm]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = userSearchTerm.trim().toLowerCase();

    return authors.filter((author) => {
      if (!normalizedQuery) return true;

      const haystack = [author.full_name, author.role, author.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [authors, userSearchTerm]);

  const filteredNewsletterSubscribers = useMemo(() => {
    const normalizedQuery = newsletterSearchTerm.trim().toLowerCase();

    return newsletterSubscribers.filter((subscriber) => {
      if (!normalizedQuery) return true;

      const haystack = [
        subscriber.email,
        subscriber.confirmed ? "confirmado" : "pendiente",
        subscriber.unsubscribed_at ? "dado de baja" : "activo",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [newsletterSubscribers, newsletterSearchTerm]);

  const filteredAccessLogs = useMemo(() => {
    const normalizedQuery = accessSearchTerm.trim().toLowerCase();

    return [...adminAccessLogs].filter((log) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          log.full_name,
          log.email,
          log.role,
          log.page_url,
          log.browser,
          log.operating_system,
          log.ip_address,
          log.status,
          formatAccessStatus(log.status),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus = accessStatusFilter === "all" || log.status === accessStatusFilter;
      const matchesRole = accessRoleFilter === "all" || log.role === accessRoleFilter;
      const matchesDate = matchesAccessDateRange(log.accessed_at, accessDateFilter);

      return matchesQuery && matchesStatus && matchesRole && matchesDate;
    });
  }, [accessDateFilter, accessRoleFilter, accessSearchTerm, accessStatusFilter, adminAccessLogs]);

  const visibleAccessLogs = useMemo(
    () => filteredAccessLogs.slice(0, accessVisibleCount),
    [accessVisibleCount, filteredAccessLogs],
  );
  const hasMoreAccessLogs = accessVisibleCount < filteredAccessLogs.length;

  const accessLogSummary = useMemo(() => {
    const total = adminAccessLogs.length;
    const success = adminAccessLogs.filter((log) => log.status === "success").length;
    const failure = adminAccessLogs.filter((log) => log.status === "failure").length;
    const last7Days = adminAccessLogs.filter((log) => {
      const accessedAt = new Date(log.accessed_at).getTime();
      const diffInDays = (Date.now() - accessedAt) / 86400000;
      return diffInDays <= 7;
    }).length;

    return { total, success, failure, last7Days };
  }, [adminAccessLogs]);

  const selectedAccessLog = useMemo(
    () =>
      selectedAccessLogId !== null
        ? (adminAccessLogs.find((log) => log.id === selectedAccessLogId) ?? null)
        : (adminAccessLogs[0] ?? null),
    [adminAccessLogs, selectedAccessLogId],
  );

  const handleLoadMoreAccessLogs = () => {
    const previousCount = accessVisibleCount;
    setAccessVisibleCount((count) => count + 10);

    requestAnimationFrame(() => {
      const tableContainer = accessTableRef.current;
      if (!tableContainer) return;

      const targetScroll = Math.max(tableContainer.scrollHeight - tableContainer.clientHeight, 0);
      tableContainer.scrollTo({ top: targetScroll, behavior: "smooth" });

      if (previousCount > 0) {
        setTimeout(() => {
          const nextTableContainer = accessTableRef.current;
          if (!nextTableContainer) return;
          nextTableContainer.scrollTo({
            top: Math.max(nextTableContainer.scrollHeight - nextTableContainer.clientHeight, 0),
            behavior: "auto",
          });
        }, 180);
      }
    });
  };

  const { data: articleComments = [], isLoading: articleCommentsLoading } = useQuery({
    queryKey: ["admin", "article-comments", managementArticleId],
    queryFn: () => getArticleCommentsForAdmin(managementArticleId!),
    enabled: canAccess && !!managementArticleId,
  });

  const removeSelectedMediaBlock = () => {
    const editor = contentEditorRef.current;
    if (!editor) return false;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const findMediaBlock = (node: Node | null): HTMLElement | null => {
      let current = node;
      while (current && current !== editor) {
        if (current instanceof HTMLElement && current.getAttribute("data-media-block") === "true") {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    };

    const selectedBlock = findMediaBlock(range.commonAncestorContainer) ?? findMediaBlock(range.startContainer);
    if (!selectedBlock) {
      const previousNode = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element).previousElementSibling
        : range.startContainer.parentElement?.previousElementSibling;
      const nextNode = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element).nextElementSibling
        : range.startContainer.parentElement?.nextElementSibling;

      const adjacentBlock = previousNode?.getAttribute("data-media-block") === "true"
        ? previousNode
        : nextNode?.getAttribute("data-media-block") === "true"
          ? nextNode
          : null;

      if (!adjacentBlock) return false;
      adjacentBlock.remove();
      setForm((prev) => ({ ...prev, content: editor.innerHTML }));
      return true;
    }

    selectedBlock.remove();
    setForm((prev) => ({ ...prev, content: editor.innerHTML }));
    return true;
  };

  const insertMarkupBlock = (markup: string) => {
    const editor = contentEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand("insertHTML", false, markup);
    setForm((prev) => ({ ...prev, content: editor.innerHTML }));
  };

  const applyTextFormat = (format: "bold" | "italic") => {
    const editor = contentEditorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(format === "bold" ? "bold" : "italic", false, undefined);
    setForm((prev) => ({ ...prev, content: editor.innerHTML }));
  };

  const normalizeVideoEmbedUrl = (rawUrl: string) => {
    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) return null;

    try {
      const url = new URL(trimmedUrl);
      const host = url.hostname.replace(/^www\./i, "").toLowerCase();
      const path = url.pathname.replace(/\/+$/, "");

      if (host === "youtu.be") {
        const id = path.split("/").filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
        const embedPath = path.match(/^\/embed\/(.+)$/)?.[1];
        if (embedPath) return `https://www.youtube.com/embed/${embedPath.split(/[/?#]/)[0]}`;

        const shortsId = path.match(/^\/shorts\/(.+)$/)?.[1];
        if (shortsId) return `https://www.youtube.com/embed/${shortsId.split(/[/?#]/)[0]}`;

        const videoId = url.searchParams.get("v");
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }

      if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
        const embedPath = path.match(/^\/embed\/(.+)$/)?.[1];
        if (embedPath) return `https://www.youtube-nocookie.com/embed/${embedPath.split(/[/?#]/)[0]}`;
      }

      if (["instagram.com", "www.instagram.com"].includes(host)) {
        const reelId = path.match(/^\/reel\/(.+)$/)?.[1] ?? path.match(/^\/reels\/(.+)$/)?.[1];
        if (reelId) {
          const sanitized = reelId.split(/[/?#]/)[0];
          return `https://www.instagram.com/reel/${sanitized}/embed/`;
        }
      }

      if (trimmedUrl.includes("youtube.com/embed/")) return trimmedUrl;
      if (trimmedUrl.includes("youtube-nocookie.com/embed/")) return trimmedUrl;
      if (trimmedUrl.includes("instagram.com/reel/")) return trimmedUrl.replace(/\/?$/, "/embed/");
    } catch {
      return null;
    }

    return null;
  };

  const insertTextMedia = async (kind: "image" | "video") => {
    const target = kind === "image" ? "imagen" : "video";
    const url = window.prompt(
      `Ingresá la URL de la ${target} que quieras insertar dentro del contenido:`,
      "https://",
    );
    if (!url) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    if (kind === "image") {
      const imageMarkup = `\n\n<div data-media-block="true" contenteditable="false" class="relative my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">\n  <button type="button" data-remove-media="true" aria-label="Eliminar imagen" class="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white/90 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-white">×</button>\n  <figure class="overflow-hidden rounded-2xl">\n    <img src="${trimmedUrl}" alt="Imagen dentro del artículo" class="w-full rounded-2xl object-cover" />\n  </figure>\n</div>\n\n`;
      insertMarkupBlock(imageMarkup);
      return;
    }

    const normalizedUrl = normalizeVideoEmbedUrl(trimmedUrl);
    if (!normalizedUrl) {
      window.alert("URL de video inválida. Usá un enlace de YouTube o Instagram reel válido.");
      return;
    }

    const videoMarkup = `\n\n<div data-media-block="true" contenteditable="false" class="relative my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">\n  <button type="button" data-remove-media="true" aria-label="Eliminar video" class="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white/90 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-white">×</button>\n  <div class="aspect-video w-full overflow-hidden rounded-2xl">\n    <iframe src="${normalizedUrl}" title="Video del artículo" class="h-full w-full border-0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>\n  </div>\n</div>\n\n`;
    insertMarkupBlock(videoMarkup);
  };

  const handleInlineMediaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    try {
      const uploadedUrls = await Promise.all(files.map((file) => uploadArticleMedia(file)));
      const validUrls = uploadedUrls.filter(Boolean);
      if (validUrls.length === 0) {
        return;
      }

      const markup = validUrls
        .map((url) => {
          const fileName = url.split("/").pop() ?? "media";
          const mimeType = fileName.toLowerCase();
          const isVideo = /\.(mp4|webm|ogg|mov|m4v)$/i.test(mimeType) || mimeType.includes("video");
          if (isVideo) {
            return `\n\n<div data-media-block="true" contenteditable="false" class="my-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">\n  <div class="aspect-video w-full overflow-hidden rounded-3xl">\n    <video src="${url}" controls class="h-full w-full object-cover" preload="metadata"></video>\n  </div>\n</div>\n\n`;
          }
          return `\n\n<div data-media-block="true" contenteditable="false" class="my-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">\n  <figure class="overflow-hidden rounded-3xl">\n    <img src="${url}" alt="Imagen dentro del artículo" class="w-full rounded-3xl object-cover" />\n  </figure>\n</div>\n\n`;
        })
        .join("");

      insertMarkupBlock(markup);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir el archivo multimedia.";
      window.alert(message);
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    const editor = contentEditorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== form.content) {
      editor.innerHTML = form.content || "";
    }

    const handleEditorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const removeButton = target?.closest("[data-remove-media]");
      if (!removeButton || !editor.contains(removeButton)) return;

      const block = removeButton.closest('[data-media-block="true"]');
      if (block) {
        event.preventDefault();
        block.remove();
        setForm((prev) => ({ ...prev, content: editor.innerHTML }));
      }
    };

    editor.addEventListener("click", handleEditorClick);
    return () => editor.removeEventListener("click", handleEditorClick);
  }, [form.content]);

  useEffect(() => {
    if (!selectedId && currentEditorialUser.id && !form.author_id) {
      setForm((current) => ({ ...current, author_id: currentEditorialUser.id }));
    }
  }, [selectedId, currentEditorialUser.id, form.author_id]);

  useEffect(() => {
    if (selectedId && !managementArticleId) {
      setManagementArticleId(selectedId);
    }
  }, [managementArticleId, selectedId]);

  const accessLogMutationRef = useRef(false);
  useEffect(() => {
    if (!canAccess || !user || accessLogMutationRef.current) {
      return;
    }

    accessLogMutationRef.current = true;
    void recordAdminAccessLog({
      user_id: user.id,
      email: user.email ?? profile?.email ?? null,
      full_name:
        profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      role: profile?.role ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      browser:
        typeof navigator !== "undefined"
          ? navigator.userAgent.includes("Edg")
            ? "Edge"
            : navigator.userAgent.includes("Chrome")
              ? "Chrome"
              : navigator.userAgent.includes("Firefox")
                ? "Firefox"
                : "Browser"
          : null,
      operating_system:
        typeof navigator !== "undefined"
          ? navigator.userAgent.includes("Windows")
            ? "Windows"
            : navigator.userAgent.includes("Mac")
              ? "macOS"
              : navigator.userAgent.includes("Android")
                ? "Android"
                : navigator.userAgent.includes("Linux")
                  ? "Linux"
                  : null
          : null,
      language: typeof navigator !== "undefined" ? navigator.language : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      page_url: typeof window !== "undefined" ? window.location.href : null,
      session_id: user.id ?? null,
      ip_address: resolveAccessIpFallback(null, user.id),
      status: "success",
      event_type: "admin_panel_access",
    });
  }, [canAccess, profile, user]);

  const accessDateOptions: Array<{
    key: "all" | "today" | "yesterday" | "last7" | "last30" | "thisMonth";
    label: string;
  }> = [
    { key: "all", label: "Todos" },
    { key: "today", label: "Hoy" },
    { key: "yesterday", label: "Ayer" },
    { key: "last7", label: "Últimos 7 Días" },
    { key: "last30", label: "Últimos 30 Días" },
    { key: "thisMonth", label: "Este Mes" },
  ];

  const exportAccessLogsCsv = () => {
    const rows = filteredAccessLogs.map((log) => [
      log.full_name ?? "",
      log.email ?? "",
      log.role ?? "",
      formatAccessStatus(log.status),
      resolveAccessIpFallback(log.ip_address, log.user_id),
      log.page_url ?? "",
      log.browser ?? "",
      getDeviceTypeFromUserAgent(log.user_agent),
      new Date(log.accessed_at).toLocaleString("es-AR"),
    ]);

    const header = [
      "Usuario",
      "Email",
      "Rol",
      "Estado",
      "IP",
      "Host",
      "Navegador",
      "Dispositivo",
      "Fecha",
    ];
    const csv = [header, ...rows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "control-acceso.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAccessLogsPdf = () => {
    if (typeof window === "undefined") return;

    const html = `
      <html>
        <head>
          <title>Control de Acceso</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h2>Control de Acceso</h2>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>IP</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAccessLogs
                .map(
                  (log) => `
                    <tr>
                      <td>${(log.full_name ?? "Sin nombre").replace(/</g, "&lt;")}</td>
                      <td>${(log.email ?? "").replace(/</g, "&lt;")}</td>
                      <td>${(log.role ?? "").replace(/</g, "&lt;")}</td>
                      <td>${formatAccessStatus(log.status)}</td>
                      <td>${resolveAccessIpFallback(log.ip_address, log.user_id).replace(/</g, "&lt;")}</td>
                      <td>${new Date(log.accessed_at).toLocaleString("es-AR")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      window.alert("El navegador bloqueó la impresión del PDF.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const targetUserAccess = useMemo(() => {
    if (!selectedAccessLog?.user_id) {
      return null;
    }

    return authors.find((author) => author.id === selectedAccessLog.user_id) ?? null;
  }, [authors, selectedAccessLog?.user_id]);

  const canBanSelectedUser = Boolean(
    selectedAccessLog &&
    selectedAccessLog.user_id !== user?.id &&
    !isProtectedAdminEmail(selectedAccessLog.email ?? null),
  );

  const handleToggleUserBan = async () => {
    if (!selectedAccessLog?.user_id) {
      return;
    }

    const isBlocked = Boolean(targetUserAccess?.is_blocked);
    const targetEmail = (selectedAccessLog.email ?? "").trim().toLowerCase();
    const targetRole = targetUserAccess?.role ?? "reader";

    if (selectedAccessLog.user_id === user?.id) {
      window.alert("No podés bloquearte a vos mismo desde el panel de administración.");
      return;
    }

    if (isProtectedAdminEmail(targetEmail)) {
      window.alert("Este usuario está protegido y no puede ser bloqueado desde el panel.");
      return;
    }

    try {
      const nextReason = isBlocked
        ? null
        : accessBanReason.trim() || "Suspendido por administración";
      const updated = await updateUserAccess(selectedAccessLog.user_id, {
        is_blocked: !isBlocked,
        blocked_reason: nextReason,
      });

      queryClient.setQueryData(["admin", "authors"], (previous: typeof authors | undefined) => {
        if (!previous) return [updated];
        return previous.map((author) => (author.id === updated.id ? updated : author));
      });

      await queryClient.invalidateQueries({ queryKey: ["admin", "authors"] });
      await queryClient.invalidateQueries({ queryKey: ["auth"] });

      if (!isBlocked && accessBanCloseSessions && selectedAccessLog.user_id === user?.id) {
        const client = requireSupabaseClient();
        await client.auth.signOut();
      }

      if (!isBlocked && accessBanCloseSessions && selectedAccessLog.user_id !== user?.id) {
        window.alert(
          "El usuario quedó bloqueado. La invalidación masiva de sesiones requiere un backend/Edge Function para cerrar todas las sesiones activas de ese perfil.",
        );
      }

      setAccessBanReason("");
      setShowAccessBanModal(false);
      setAccessBanCloseSessions(true);
      window.alert(
        isBlocked ? "Usuario habilitado correctamente." : "Usuario bloqueado correctamente.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar el estado del usuario.";
      window.alert(message);
    }
  };

  useEffect(() => {
    setAccessVisibleCount(10);
  }, [accessSearchTerm, accessStatusFilter, accessRoleFilter, accessDateFilter]);

  const navItems = useMemo(
    () =>
      isEditorUser
        ? [
            { id: "articles", label: "Artículos", icon: Newspaper },
            { id: "new", label: "Crear artículo", icon: PlusCircle },
          ]
        : [
            { id: "overview", label: "Resumen", icon: LayoutDashboard },
            { id: "articles", label: "Artículos", icon: Newspaper },
            { id: "new", label: "Crear artículo", icon: PlusCircle },
            ...(isAdminUser
              ? [
                  { id: "management", label: "Administrar", icon: Sparkles },
                  { id: "general", label: "General", icon: Users },
                  { id: "categories", label: "Categorías", icon: FileImage },
                  { id: "tags", label: "Etiquetas", icon: Sparkles },
                  { id: "authors", label: "Autores", icon: Users },
                  { id: "users", label: "Usuarios", icon: Users },
                  { id: "newsletter", label: "Newsletter", icon: Mail },
                  { id: "access-control", label: "Control de Acceso", icon: ShieldCheck },
                ]
              : []),
          ],
    [isAdminUser, isEditorUser],
  );

  const visibleTab = navItems.some((item) => item.id === activeTab)
    ? activeTab
    : isEditorUser
      ? "new"
      : "overview";

  useEffect(() => {
    if (!navItems.some((item) => item.id === activeTab)) {
      setActiveTab(isEditorUser ? "new" : "overview");
    }
  }, [activeTab, isEditorUser, navItems]);

  const summary = useMemo(() => {
    const published = articles.filter((article) => article.status === "published").length;
    const drafts = articles.filter((article) => article.status === "draft").length;
    const featured = articles.filter((article) => article.is_featured).length;
    const reviewQueue = articles.filter(
      (article) => article.status === "draft" || article.status === "scheduled",
    ).length;

    return { total: articles.length, published, drafts, featured, reviewQueue };
  }, [articles]);

  const editorialQueue = useMemo(
    () =>
      [...articles]
        .filter((article) => article.status === "draft" || article.status === "scheduled")
        .sort(
          (left, right) =>
            Number(new Date(right.published_at ?? right.scheduled_at ?? 0)) -
            Number(new Date(left.published_at ?? left.scheduled_at ?? 0)),
        )
        .slice(0, 4),
    [articles],
  );

  const commentStatsByArticle = useMemo(() => {
    const stats = new Map<string, { count: number; likes: number }>();

    for (const comment of adminCommentSummary) {
      const existing = stats.get(comment.article_id) ?? { count: 0, likes: 0 };
      stats.set(comment.article_id, {
        count: existing.count + 1,
        likes: existing.likes + comment.like_count,
      });
    }

    return stats;
  }, [adminCommentSummary]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resolvedAuthorId =
        form.author_id ?? currentEditorialUser.id ?? editorialAuthors[0]?.id ?? null;
      if (!resolvedAuthorId) {
        throw new Error("No hay un autor editorial disponible para publicar este artículo.");
      }

      setForm((current) => ({ ...current, author_id: resolvedAuthorId }));

      const payload = buildArticlePayload({ ...form, author_id: resolvedAuthorId }, selectedArticle, new Date());

      const saved = selectedArticle
        ? await updateArticle(selectedArticle.id, payload)
        : await createArticle(payload);
      await syncArticleTags(saved.id, form.tag_ids);

      if (isNewlyPublished(selectedArticle?.status, saved.status)) {
        trackArticlePublished(saved.title, saved.category?.name ?? null);
      }
      return saved;
    },
    onSuccess: async (saved) => {
      clearDraft();
      // Wait for the list first: selecting an id it does not have yet would look like a deleted article.
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
      setSelectedId(saved.id);
      await queryClient.invalidateQueries({ queryKey: ["latest"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      await queryClient.invalidateQueries({ queryKey: ["breaking"] });
      await queryClient.invalidateQueries({ queryKey: ["category"] });
      await queryClient.invalidateQueries({ queryKey: ["article"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async () => {
      const name = categoryForm.name.trim();
      if (!name) throw new Error("El nombre de la categoría es obligatorio.");

      if (editingCategoryId) {
        return updateCategory(editingCategoryId, {
          name,
          slug: (categoryForm.slug || createSlug(name)).trim() || createSlug(name),
          color: categoryForm.color,
          sort_order: Number(categoryForm.sort_order || 0),
        });
      }

      return createCategory({
        name,
        slug: (categoryForm.slug || createSlug(name)).trim() || createSlug(name),
        color: categoryForm.color,
        sort_order: Number(categoryForm.sort_order || 0),
      });
    },
    onSuccess: async () => {
      setCategoryForm({ name: "", slug: "", color: "#E33A2E", sort_order: 0 });
      setEditingCategoryId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const tagMutation = useMutation({
    mutationFn: async () => {
      const name = tagForm.name.trim();
      if (!name) throw new Error("El nombre de la etiqueta es obligatorio.");

      if (editingTagId) {
        return updateTag(editingTagId, {
          name,
          slug: (tagForm.slug || createSlug(name)).trim() || createSlug(name),
        });
      }

      return createTag({
        name,
        slug: (tagForm.slug || createSlug(name)).trim() || createSlug(name),
      });
    },
    onSuccess: async () => {
      setTagForm({ name: "", slug: "" });
      setEditingTagId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
    },
  });

  const authorRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "reader" | "editor" | "admin" }) =>
      updateAuthorRole(id, role),
    onSuccess: async (updatedAuthor) => {
      queryClient.setQueryData(["admin", "authors"], (previous: typeof authors | undefined) => {
        if (!previous) return [updatedAuthor];
        return previous.map((author) => (author.id === updatedAuthor.id ? updatedAuthor : author));
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "authors"] });
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar el rol del usuario.";
      window.alert(message);
    },
  });

  const parseCoverGallery = (value: string | null | undefined) =>
    Array.from(
      new Set(
        (value ?? "")
          .split(/\s*(?:\n|,|;|\|\|)\s*/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

  useEffect(() => {
    const nextGallery = parseCoverGallery(form.cover_image_url);

    if (nextGallery.length === 0) {
      setCoverGallery([]);
      setActiveCoverIndex(0);
      return;
    }

    setCoverGallery((currentGallery) => {
      const hasChanged =
        currentGallery.length !== nextGallery.length ||
        currentGallery.some((item, index) => item !== nextGallery[index]);
      if (hasChanged) {
        setActiveCoverIndex(0);
      }

      return nextGallery;
    });
  }, [form.cover_image_url]);

  useEffect(() => {
    if (coverGallery.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveCoverIndex((currentIndex) => (currentIndex + 1) % coverGallery.length);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [coverGallery]);

  const processCoverFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => file && file.type.startsWith("image/"));

    if (validFiles.length === 0) {
      window.alert("Seleccioná archivos de imagen válidos.");
      return;
    }

    try {
      const uploadedUrls = await Promise.all(validFiles.map((file) => uploadArticleCover(file)));
      const mergedGallery = Array.from(new Set([...coverGallery, ...uploadedUrls].filter(Boolean)));

      if (mergedGallery.length === 0) return;

      setCoverGallery(mergedGallery);
      setActiveCoverIndex(0);
      setForm((prev) => ({ ...prev, cover_image_url: mergedGallery[0] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir la imagen.";
      window.alert(message);
    }
  };

  const processCoverFile = async (file?: File | null) => {
    if (!file) return;
    await processCoverFiles([file]);
  };

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await processCoverFiles(files);
    event.target.value = "";
  };

  const handleDeleteArticle = async (articleId: string) => {
    const confirmed = window.confirm("¿Seguro que querés eliminar este artículo?");
    if (!confirmed) return;

    await deleteArticle(articleId);
    resetForm();
    setSelectedId(null);
    setActiveTab("articles");
    await queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
    await queryClient.invalidateQueries({ queryKey: ["latest"] });
    await queryClient.invalidateQueries({ queryKey: ["featured"] });
    await queryClient.invalidateQueries({ queryKey: ["breaking"] });
  };

  const handleDeleteComment = async (commentId: number) => {
    const confirmed = window.confirm("¿Seguro que querés eliminar este comentario?");
    if (!confirmed) return;

    try {
      await deleteCommentForAdmin(commentId);
      await queryClient.invalidateQueries({
        queryKey: ["admin", "article-comments", managementArticleId],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el comentario.";
      window.alert(message);
    }
  };

  const handleWorkflowChange = async (articleId: string, nextStatus: AdminArticle["status"]) => {
    const article = articles.find((item) => item.id === articleId);
    if (!article) return;

    if (nextStatus === "scheduled" && !article.scheduled_at) {
      window.alert("Elegí la fecha de publicación en el editor del artículo.");
      setSelectedId(articleId);
      setActiveTab("new");
      return;
    }

    try {
      await updateArticle(articleId, {
        status: nextStatus,
        published_at:
          article.published_at ?? (nextStatus === "published" ? new Date().toISOString() : null),
        scheduled_at: nextStatus === "scheduled" ? article.scheduled_at : null,
      });

      if (isNewlyPublished(article.status, nextStatus)) {
        trackArticlePublished(article.title, article.category?.name ?? null);
      }

      await queryClient.invalidateQueries({ queryKey: ["admin", "articles"] });
      await queryClient.invalidateQueries({ queryKey: ["latest"] });
      await queryClient.invalidateQueries({ queryKey: ["featured"] });
      setManagementArticleId(articleId);
      setSelectedId(articleId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar el estado del artículo.";
      window.alert(message);
    }
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setActiveTab("new");
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando sesión…
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="text-2xl font-bold text-foreground">Página no encontrada</h2>
        <p className="text-muted-foreground">
          La página que buscás no existe o no tenés permisos para verla.
        </p>
        <Link
          to="/"
          className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 text-sm text-muted-foreground">
        Cargando panel…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-red-600">
        No se pudieron cargar los artículos del panel.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3efee] px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-[#f7f6f5] px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-slate-900 text-sm font-black text-white shadow-sm">
              Q
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Editorial
              </p>
              <h1 className="text-2xl font-black text-slate-900">QAP Chaco News</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminUser && (
              <div className="rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <CurrencyTicker className="border-slate-200 bg-slate-900 text-white hover:border-slate-700 hover:bg-slate-800" />
              </div>
            )}
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <PlusCircle className="h-4 w-4" /> Nuevo artículo
            </button>
            <Link
              to="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Volver al sitio
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-6 xl:flex-row">
          <aside className="w-full rounded-[22px] border border-slate-200 bg-[#f7f5f3] p-4 xl:max-w-[300px]">
            <div className="mb-4 flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <UserAvatar
                name={profile?.full_name || user?.full_name || user?.email || "Administrador"}
                avatarUrl={profile?.avatar_url || user?.avatar_url || null}
                sizeClass="h-12 w-12"
                textClass="text-sm"
                fallbackBg="bg-slate-900 text-white"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {profile?.full_name || user?.full_name || user?.email || "Administrador"}
                </p>
                <p className="text-[11px] capitalize text-slate-500">
                  {profile?.role || user?.role || "editor"}
                </p>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={[
                    "flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left text-sm font-medium transition",
                    visibleTab === id
                      ? "bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.04)] ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white hover:text-slate-900",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 rounded-[22px] border border-slate-200 bg-[#faf9f8] p-4 sm:p-5">
            {visibleTab !== "access-control" && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Centro de trabajo
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">
                    {visibleTab === "overview" && "Resumen"}
                    {visibleTab === "articles" && "Artículos"}
                    {visibleTab === "new" && "Crear artículo"}
                    {visibleTab === "management" && "Administrar"}
                    {visibleTab === "general" && "Administración general"}
                    {visibleTab === "categories" && "Categorías"}
                    {visibleTab === "tags" && "Etiquetas"}
                    {visibleTab === "authors" && "Autores"}
                    {visibleTab === "users" && "Usuarios"}
                    {visibleTab === "newsletter" && "Newsletter"}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                    Online
                  </span>
                </div>
              </div>
            )}

            {showAccessBanModal && selectedAccessLog?.user_id && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <div className="mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-500">
                      Seguridad
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">
                      {targetUserAccess?.is_blocked ? "Desbloquear usuario" : "Bloquear usuario"}
                    </h3>
                  </div>

                  <label className="mb-3 block text-sm font-medium text-slate-700">
                    Motivo de suspensión
                    <textarea
                      value={accessBanReason}
                      onChange={(event) => setAccessBanReason(event.target.value)}
                      rows={4}
                      placeholder="Ej.: incumplimiento de normas o actividad sospechosa..."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-400"
                    />
                  </label>

                  <label className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={accessBanCloseSessions}
                      onChange={(event) => setAccessBanCloseSessions(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    Cerrar todas sus sesiones activas inmediatamente
                  </label>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccessBanModal(false);
                        setAccessBanReason("");
                        setAccessBanCloseSessions(true);
                      }}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleUserBan}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
                    >
                      {targetUserAccess?.is_blocked ? "Desbloquear" : "Bloquear usuario"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {visibleTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      id: "articles",
                      label: "Contenido",
                      description: "Revisar, editar y mantener los artículos publicados.",
                      icon: Newspaper,
                      accent: "from-primary/15 via-primary/5 to-transparent",
                    },
                    {
                      id: "new",
                      label: "Crear artículo",
                      description: "Publicar una nueva nota con portada, SEO y contenido.",
                      icon: PlusCircle,
                      accent: "from-emerald-500/15 via-emerald-500/5 to-transparent",
                    },
                    {
                      id: "management",
                      label: "Administrar",
                      description: "Controlar vistas, comentarios, likes y moderación.",
                      icon: LayoutDashboard,
                      accent: "from-amber-500/15 via-amber-500/5 to-transparent",
                    },
                    {
                      id: "general",
                      label: "Administración general",
                      description:
                        "Roles, permisos, categorías, etiquetas y configuración del equipo.",
                      icon: Users,
                      accent: "from-sky-500/15 via-sky-500/5 to-transparent",
                    },
                  ].map(({ id, label, description, icon: Icon, accent }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id as typeof activeTab)}
                      className="group rounded-[20px] border border-slate-200 bg-white p-5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_36px_rgba(15,23,42,0.06)]"
                    >
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Panel
                      </p>
                      <h2 className="mt-3 text-[1.7rem] font-black leading-tight text-slate-900">
                        {label}
                      </h2>
                      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">
                        {description}
                      </p>
                      <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-900">
                        Entrar
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-3xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                          Artículos
                        </p>
                        <h3 className="text-2xl font-black text-foreground">Estado editorial</h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateNew}
                        className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                      >
                        Nuevo artículo
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-secondary p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Publicados
                        </div>
                        <div className="mt-2 text-3xl font-black text-foreground">
                          {summary.published}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-secondary p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Borradores
                        </div>
                        <div className="mt-2 text-3xl font-black text-foreground">
                          {summary.drafts}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-secondary p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          Destacados
                        </div>
                        <div className="mt-2 text-3xl font-black text-foreground">
                          {summary.featured}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                          Acceso rápido
                        </p>
                        <h3 className="text-xl font-black text-foreground">Herramientas clave</h3>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab("categories")}
                        className="flex w-full items-center justify-between rounded-2xl border bg-background p-3 text-left transition hover:bg-accent"
                      >
                        <span className="font-semibold text-foreground">Categorías</span>
                        <span className="text-xs text-muted-foreground">Gestionar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("tags")}
                        className="flex w-full items-center justify-between rounded-2xl border bg-background p-3 text-left transition hover:bg-accent"
                      >
                        <span className="font-semibold text-foreground">Etiquetas</span>
                        <span className="text-xs text-muted-foreground">Organizar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("authors")}
                        className="flex w-full items-center justify-between rounded-2xl border bg-background p-3 text-left transition hover:bg-accent"
                      >
                        <span className="font-semibold text-foreground">Roles del equipo</span>
                        <span className="text-xs text-muted-foreground">Permisos</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                        Selección rápida
                      </p>
                      <h3 className="text-xl font-black text-foreground">Artículos recientes</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredArticles.slice(0, 5).map((article) => (
                      <div
                        key={article.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border bg-background p-3"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{article.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {article.category?.name ?? "Sin categoría"} •{" "}
                            {article.author?.full_name ?? "Sin autor"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(article.id);
                            setManagementArticleId(article.id);
                            setActiveTab("articles");
                          }}
                          className="rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                        >
                          Abrir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {visibleTab === "access-control" && (
              <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      SEGURIDAD
                    </p>
                    <h2 className="text-2xl font-black text-foreground">Control de Acceso</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={exportAccessLogsCsv}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportAccessLogsPdf}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Exportar PDF
                    </button>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap gap-2">
                  {accessDateOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAccessDateFilter(option.key)}
                      className={[
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        accessDateFilter === option.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Total</p>
                    <p className="mt-2 text-3xl font-black text-foreground">
                      {accessLogSummary.total}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Exitosos
                    </p>
                    <p className="mt-2 text-3xl font-black text-emerald-600">
                      {accessLogSummary.success}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Fallidos
                    </p>
                    <p className="mt-2 text-3xl font-black text-rose-600">
                      {accessLogSummary.failure}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Últimos 7 días
                    </p>
                    <p className="mt-2 text-3xl font-black text-foreground">
                      {accessLogSummary.last7Days}
                    </p>
                  </div>
                </div>

                <div className="mb-6 grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr]">
                  <input
                    value={accessSearchTerm}
                    onChange={(event) => setAccessSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre, email, rol, host o IP"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                  />
                  <select
                    value={accessStatusFilter}
                    onChange={(event) =>
                      setAccessStatusFilter(event.target.value as "all" | "success" | "failure")
                    }
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="success">Exitosos</option>
                    <option value="failure">Fallidos</option>
                  </select>
                  <select
                    value={accessRoleFilter}
                    onChange={(event) => setAccessRoleFilter(event.target.value as "all" | string)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                  >
                    <option value="all">Todos los roles</option>
                    {[...new Set(adminAccessLogs.map((log) => log.role).filter(Boolean))].map(
                      (role) => (
                        <option key={role} value={role ?? ""}>
                          {role}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr] xl:items-start">
                  <div className="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border bg-background">
                    <div
                      ref={accessTableRef}
                      className="max-h-[68vh] min-h-[18rem] overflow-y-auto overscroll-contain"
                    >
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-sm">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Usuario</th>
                              <th className="px-4 py-3 font-semibold">Rol</th>
                              <th className="px-4 py-3 font-semibold">Estado</th>
                              <th className="px-4 py-3 font-semibold">Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleAccessLogs.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-4 py-8 text-center text-sm text-slate-500"
                                >
                                  No hay accesos registrados con el filtro actual.
                                </td>
                              </tr>
                            ) : (
                              visibleAccessLogs.map((log) => {
                                const deviceType = getDeviceTypeFromUserAgent(log.user_agent);
                                const DeviceIcon = getDeviceIconForType(deviceType);

                                return (
                                  <tr
                                    key={log.id}
                                    onClick={() => setSelectedAccessLogId(log.id)}
                                    className={[
                                      "cursor-pointer border-t border-slate-200 transition hover:bg-slate-50",
                                      selectedAccessLog?.id === log.id ? "bg-slate-50" : "",
                                    ].join(" ")}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                                          <DeviceIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-900">
                                              {log.full_name || "Sin nombre"}
                                            </span>
                                            {authors.some(
                                              (author) =>
                                                author.id === log.user_id && author.is_blocked,
                                            ) && (
                                              <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-700">
                                                BLOQUEADO
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {log.email || "Sin email"}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{log.role || "—"}</td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={[
                                          "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                                          log.status === "success"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : log.status === "failure"
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-slate-200 text-slate-700",
                                        ].join(" ")}
                                      >
                                        {formatAccessStatus(log.status)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                      {new Date(log.accessed_at).toLocaleString("es-AR", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      })}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {hasMoreAccessLogs && (
                      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50/95 p-2 text-center backdrop-blur-sm">
                        <button
                          type="button"
                          onClick={handleLoadMoreAccessLogs}
                          className="w-full rounded-full bg-slate-900 px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          Cargar más
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-background p-4">
                    {selectedAccessLog ? (
                      <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center pb-2 text-center">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                            Detalle
                          </p>
                          <div className="mt-3">
                            <UserAvatar
                              name={
                                selectedAccessLog.full_name ||
                                selectedAccessLog.email ||
                                "Usuario"
                              }
                              avatarUrl={targetUserAccess?.avatar_url ?? null}
                              sizeClass="h-20 w-20"
                              textClass="text-xl"
                              fallbackBg="bg-slate-900 text-white"
                            />
                          </div>
                          <h3 className="mt-3 text-center text-xl font-black text-slate-900">
                            {selectedAccessLog.full_name || "Acceso sin nombre"}
                          </h3>
                        </div>

                        <div className="space-y-3 text-sm text-slate-600">
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Email</span>
                            <span className="font-medium text-slate-900">
                              {selectedAccessLog.email || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Rol</span>
                            <span className="font-medium text-slate-900">
                              {selectedAccessLog.role || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Estado</span>
                            <span className="font-medium text-slate-900">
                              {formatAccessStatus(selectedAccessLog.status)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Dispositivo</span>
                            <span className="font-medium text-slate-900">
                              {getDeviceTypeFromUserAgent(selectedAccessLog.user_agent)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Host</span>
                            <span className="font-medium text-slate-900 break-all">
                              {selectedAccessLog.page_url || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>IP</span>
                            <span className="font-medium text-slate-900 break-all">
                              {resolveAccessIpFallback(
                                selectedAccessLog.ip_address,
                                selectedAccessLog.user_id,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Navegador</span>
                            <span className="font-medium text-slate-900">
                              {selectedAccessLog.browser || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Sistema</span>
                            <span className="font-medium text-slate-900">
                              {selectedAccessLog.operating_system || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Idioma</span>
                            <span className="font-medium text-slate-900">
                              {selectedAccessLog.language || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Timezone</span>
                            <span className="font-medium text-slate-900">
                              {selectedAccessLog.timezone || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Referrer</span>
                            <span className="font-medium text-slate-900 break-all">
                              {selectedAccessLog.referrer || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
                            <span>Session ID</span>
                            <span className="font-medium text-slate-900 break-all">
                              {selectedAccessLog.session_id || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Último acceso</span>
                            <span className="font-medium text-slate-900">
                              {new Date(selectedAccessLog.accessed_at).toLocaleString("es-AR", {
                                dateStyle: "medium",
                                timeStyle: "medium",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-rose-600">
                            Acción
                          </p>

                          {canBanSelectedUser &&
                            (targetUserAccess?.is_blocked ? (
                              <>
                                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                  <span>Usuario Suspendido</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleToggleUserBan}
                                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-500"
                                >
                                  Desbloquear / Habilitar Usuario
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowAccessBanModal(true)}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-500"
                              >
                                Bloquear / Banear Usuario
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
                        Seleccioná un registro para ver el detalle completo.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "articles" && (
              <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Contenido
                    </p>
                    <h2 className="text-2xl font-black text-foreground">Artículos</h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    <PlusCircle className="h-4 w-4" /> Nuevo artículo
                  </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="rounded-2xl border bg-background p-3">
                    <div className="mb-3 space-y-3">
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar noticias o autores"
                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                      />
                      <select
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as "all" | AdminArticle["status"])
                        }
                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                      >
                        <option value="all">Todos los estados</option>
                        <option value="draft">Borrador</option>
                        <option value="scheduled">Programado</option>
                        <option value="published">Publicado</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      {filteredArticles.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-border bg-background p-3 text-sm text-muted-foreground">
                          No hay artículos con ese filtro.
                        </p>
                      ) : (
                        filteredArticles.map((article) => {
                          const stats = commentStatsByArticle.get(article.id) ?? {
                            count: 0,
                            likes: 0,
                          };

                          return (
                            <button
                              key={article.id}
                              type="button"
                              onClick={() => {
                                setSelectedId(article.id);
                                setManagementArticleId(article.id);
                              }}
                              className={[
                                "w-full overflow-hidden rounded-2xl border p-2 text-left transition",
                                selectedArticle?.id === article.id
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-border bg-background hover:bg-slate-50",
                              ].join(" ")}
                            >
                              <div className="flex gap-3">
                                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-background">
                                  {article.cover_image_url ? (
                                    <img
                                      src={article.cover_image_url}
                                      alt={article.title}
                                      className="h-full w-full bg-background object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center bg-background text-[10px] font-bold uppercase text-slate-400">
                                      No image
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="line-clamp-2 text-sm font-bold text-slate-900">
                                      {article.title}
                                    </span>
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                      {article.status}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-[11px] text-slate-500">
                                    {article.category?.name ?? "Sin categoría"} •{" "}
                                    {article.author?.full_name ?? "Sin autor"}
                                  </div>
                                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                                    <span>Vistas {article.views_count}</span>
                                    <span>Com. {stats.count}</span>
                                    <span>Likes {stats.likes}</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </aside>

                  <div className="rounded-2xl border bg-background p-4">
                    {!selectedArticle ? (
                      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                        Seleccioná un artículo para editarlo o revisarlo.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                              Artículo seleccionado
                            </p>
                            <h3 className="mt-1 text-2xl font-black text-foreground">
                              {selectedArticle.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab("new")}
                            className="rounded-full border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                          >
                            Editar
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl bg-secondary p-4">
                            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                              Vistas
                            </p>
                            <p className="mt-2 text-2xl font-black text-foreground">
                              {selectedArticle.views_count}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-secondary p-4">
                            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                              Comentarios
                            </p>
                            <p className="mt-2 text-2xl font-black text-foreground">
                              {commentStatsByArticle.get(selectedArticle.id)?.count ?? 0}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-secondary p-4">
                            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                              Likes
                            </p>
                            <p className="mt-2 text-2xl font-black text-foreground">
                              {commentStatsByArticle.get(selectedArticle.id)?.likes ?? 0}
                            </p>
                          </div>
                        </div>

                        {selectedArticle.cover_image_url && (
                          <div className="overflow-hidden rounded-2xl bg-background">
                            <img
                              src={selectedArticle.cover_image_url}
                              alt={selectedArticle.title}
                              className="h-52 w-full bg-background object-cover"
                            />
                          </div>
                        )}

                        <div className="rounded-2xl border bg-background p-4">
                          <p className="text-sm font-medium text-slate-500">Resumen</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">
                            {selectedArticle.category?.name ?? "Sin categoría"} •{" "}
                            {selectedArticle.author?.full_name ?? "Sin autor"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {selectedArticle.excerpt || "Este artículo todavía no tiene extracto."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "new" && (
              <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Editor
                    </p>
                    <h2 className="text-2xl font-black text-foreground">
                      {selectedArticle
                        ? `Editando: ${selectedArticle.title}`
                        : "Crear nuevo artículo"}
                    </h2>
                  </div>
                  {selectedArticle && (
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      className="rounded-full border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                    >
                      Crear otro
                    </button>
                  )}
                </div>

                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveMutation.mutate();
                  }}
                >
                  {hasRestoredDraft && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <span>Recuperamos un borrador que no se había guardado.</span>
                      <button type="button" onClick={resetForm} className="font-semibold underline underline-offset-2">
                        Descartar borrador
                      </button>
                    </div>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-foreground">Título</span>
                      <input
                        value={form.title}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        placeholder="Ej: El Chaco abre una nueva etapa de inversión"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Slug</span>
                      <input
                        value={form.slug}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, slug: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        placeholder="ejemplo-slug"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Estado</span>
                      <select
                        value={form.status}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            status: event.target.value as AdminArticle["status"],
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                      >
                        <option value="draft">Borrador</option>
                        <option value="scheduled">Programado</option>
                        <option value="published">Publicado</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </label>

                    {form.status === "scheduled" && (
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-foreground">
                          Programar publicación
                        </span>
                        <input
                          type="datetime-local"
                          value={form.scheduled_at}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, scheduled_at: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        />
                      </label>
                    )}

                    <div className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Autor</span>
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={lockedAuthor?.full_name ?? currentEditorialUser.name}
                            avatarUrl={lockedAuthor?.avatar_url ?? null}
                            sizeClass="h-10 w-10"
                            textClass="text-xs"
                            fallbackBg="bg-slate-900 text-white"
                          />
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {lockedAuthor?.full_name ?? currentEditorialUser.name}
                            </p>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Editor principal
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                          Fijo
                        </span>
                      </div>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Categoría</span>
                      <select
                        value={form.category_id ?? ""}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, category_id: event.target.value || null }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                      >
                        <option value="">Sin categoría</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">Etiquetas</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {form.tag_ids.length} seleccionadas
                        </span>
                      </div>

                      <div className="flex min-h-12 flex-wrap gap-2 rounded-xl border border-input bg-background p-3">
                        {adminTags.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Todavía no hay etiquetas creadas. Podés crear una desde la sección de
                            etiquetas.
                          </p>
                        ) : (
                          adminTags.map((tag) => {
                            const selected = form.tag_ids.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() =>
                                  setForm((prev) => {
                                    const nextTagIds = prev.tag_ids.includes(tag.id)
                                      ? prev.tag_ids.filter((id) => id !== tag.id)
                                      : [...prev.tag_ids, tag.id];
                                    return { ...prev, tag_ids: nextTagIds };
                                  })
                                }
                                className={[
                                  "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-input bg-background text-foreground hover:border-primary/60 hover:bg-accent",
                                ].join(" ")}
                              >
                                #{tag.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-foreground">Imagen principal</span>

                      <div
                        onDragOver={(event) => {
                          event.preventDefault();
                          setIsCoverDragging(true);
                        }}
                        onDragLeave={(event) => {
                          event.preventDefault();
                          setIsCoverDragging(false);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setIsCoverDragging(false);
                          const files = Array.from(event.dataTransfer.files ?? []);
                          void processCoverFiles(files);
                        }}
                        className={[
                          "group relative overflow-hidden rounded-[24px] border border-dashed transition-all duration-200",
                          isCoverDragging
                            ? "border-primary bg-primary/5 shadow-[0_18px_32px_rgba(15,23,42,0.06)]"
                            : "border-slate-300 bg-slate-50/80",
                        ].join(" ")}
                      >
                        {coverGallery.length > 0 ? (
                          <>
                            <div
                              className="overflow-hidden rounded-[20px]"
                              style={{ aspectRatio: "16 / 9" }}
                            >
                              <div
                                className="flex h-full transition-transform duration-700 ease-out"
                                style={{ transform: `translateX(-${activeCoverIndex * 100}%)` }}
                              >
                                {coverGallery.map((url, index) => (
                                  <div key={`${url}-${index}`} className="min-w-full">
                                    <img
                                      src={url}
                                      alt="Vista previa del artículo"
                                      className="h-full w-full bg-white object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            {coverGallery.length > 1 && (
                              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                                <div className="flex items-center gap-2 rounded-full border border-white/60 bg-slate-950/60 px-3 py-1.5 backdrop-blur-sm">
                                  {coverGallery.map((_, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      aria-label={`Ver imagen ${index + 1}`}
                                      onClick={() => setActiveCoverIndex(index)}
                                      className={`h-2.5 rounded-full transition-all ${
                                        activeCoverIndex === index
                                          ? "w-7 bg-white"
                                          : "w-2.5 bg-white/40 hover:bg-white/70"
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-slate-950/70 px-3 py-2 backdrop-blur-sm">
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                                  Portada actual
                                </p>
                                <p className="truncate text-sm text-white">
                                  {coverGallery[activeCoverIndex]}
                                </p>
                              </div>
                              <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-100">
                                Cambiar
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={handleCoverUpload}
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-8 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                              <ImageUp className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="text-base font-bold text-slate-900">
                                Arrastrá una imagen aquí
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                o seleccioná un archivo desde tu computadora
                              </p>
                            </div>
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
                              Elegir archivo
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleCoverUpload}
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          value={coverGallery.join(", ") || form.cover_image_url}
                          onChange={(event) => {
                            const urls = parseCoverGallery(event.target.value);
                            if (urls.length === 0) {
                              setCoverGallery([]);
                              setActiveCoverIndex(0);
                              setForm((prev) => ({ ...prev, cover_image_url: "" }));
                              return;
                            }

                            setCoverGallery(urls);
                            setActiveCoverIndex(0);
                            setForm((prev) => ({ ...prev, cover_image_url: urls[0] }));
                          }}
                          className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                          placeholder="https://... o pegar URL de la imagen"
                        />
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent">
                          Subir archivo
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleCoverUpload}
                          />
                        </label>
                      </div>
                    </div>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-foreground">Extracto</span>
                      <textarea
                        value={form.excerpt}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, excerpt: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-foreground">SEO Title</span>
                      <input
                        value={form.seo_title}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, seo_title: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-medium text-foreground">SEO Description</span>
                      <textarea
                        value={form.seo_description}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, seo_description: event.target.value }))
                        }
                        rows={2}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
                      />
                    </label>

                    <div className="space-y-2 md:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">Contenido</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          Formato simple
                        </span>
                      </div>
                      <RichTextToolbar
                        onFormat={applyTextFormat}
                        onInsertImage={() => insertTextMedia("image")}
                        onInsertVideo={() => insertTextMedia("video")}
                        onUploadMedia={() => mediaInputRef.current?.click()}
                      />
                      <input
                        ref={mediaInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={handleInlineMediaUpload}
                      />
                      <div
                        ref={contentEditorRef}
                        role="textbox"
                        aria-label="Contenido del artículo"
                        tabIndex={0}
                        suppressContentEditableWarning
                        contentEditable
                        dir="ltr"
                        style={{ direction: "ltr", textAlign: "left" }}
                        onKeyDown={(event) => {
                          if ((event.key === "Backspace" || event.key === "Delete") && removeSelectedMediaBlock()) {
                            event.preventDefault();
                          }
                        }}
                        onInput={(event) => {
                          const element = event.currentTarget;
                          setForm((prev) => ({ ...prev, content: element.innerHTML }));
                        }}
                        className="min-h-[260px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm leading-7 text-foreground outline-none transition focus:border-primary empty:before:pointer-events-none empty:before:block empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                        data-placeholder="Escribí la nota completa…"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={form.is_featured}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, is_featured: event.target.checked }))
                        }
                      />
                      Destacado
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={form.is_breaking}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, is_breaking: event.target.checked }))
                        }
                      />
                      Breaking
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {authors.length} autores disponibles
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedArticle && (
                        <button
                          type="button"
                          onClick={() => handleDeleteArticle(selectedArticle.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          Eliminar artículo
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={saveMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Save className="h-4 w-4" />
                        {saveMutation.isPending
                          ? "Guardando…"
                          : selectedArticle
                            ? "Guardar cambios"
                            : "Publicar artículo"}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            )}

            {visibleTab === "general" && (
              <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Administración general
                    </p>
                    <h2 className="text-2xl font-black text-foreground">
                      Configuración editorial y permisos
                    </h2>
                  </div>
                  <div className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                    Roles y estructura
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("authors")}
                    className="rounded-3xl border border-border bg-background p-5 text-left transition hover:border-primary/60 hover:bg-accent"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Usuarios
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-foreground">Roles</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ver y modificar permisos del equipo editorial.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("categories")}
                    className="rounded-3xl border border-border bg-background p-5 text-left transition hover:border-primary/60 hover:bg-accent"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Estructura
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-foreground">Categorías</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Organizar secciones y temas del sitio.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("tags")}
                    className="rounded-3xl border border-border bg-background p-5 text-left transition hover:border-primary/60 hover:bg-accent"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Etiquetas
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-foreground">Temas</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Clasificar contenido por temas y señales de interés.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("newsletter")}
                    className="rounded-3xl border border-border bg-background p-5 text-left transition hover:border-primary/60 hover:bg-accent"
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Newsletter
                    </p>
                    <h3 className="mt-3 text-2xl font-black text-foreground">Suscriptores</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Revisar emails activos, pendientes y dados de baja.
                    </p>
                  </button>
                </div>
              </section>
            )}

            {visibleTab === "newsletter" && (
              <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Suscriptores
                    </p>
                    <h2 className="text-2xl font-black text-foreground">Newsletter</h2>
                  </div>
                  <div className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                    {newsletterSubscribers.length} registrados
                  </div>
                </div>

                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="w-full md:max-w-md">
                    <input
                      value={newsletterSearchTerm}
                      onChange={(event) => setNewsletterSearchTerm(event.target.value)}
                      placeholder="Buscar por email o estado"
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                    />
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {filteredNewsletterSubscribers.length} resultados
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-background">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border text-left text-sm">
                      <thead className="bg-secondary/60 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Suscripto</th>
                          <th className="px-4 py-3 font-semibold">Último cambio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-background">
                        {filteredNewsletterSubscribers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-10 text-center text-sm text-muted-foreground"
                            >
                              No hay suscriptores con ese filtro.
                            </td>
                          </tr>
                        ) : (
                          filteredNewsletterSubscribers.map((subscriber) => {
                            const isInactive = Boolean(subscriber.unsubscribed_at);
                            const isConfirmed = subscriber.confirmed && !isInactive;

                            return (
                              <tr key={subscriber.id} className="align-top">
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {subscriber.email}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={[
                                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
                                      isInactive
                                        ? "bg-red-100 text-red-700"
                                        : isConfirmed
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-amber-100 text-amber-700",
                                    ].join(" ")}
                                  >
                                    {isInactive
                                      ? "Dado de baja"
                                      : isConfirmed
                                        ? "Activo"
                                        : "Pendiente"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {subscriber.subscribed_at
                                    ? new Date(subscriber.subscribed_at).toLocaleDateString(
                                        "es-PY",
                                        { dateStyle: "medium" },
                                      )
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {subscriber.unsubscribed_at
                                    ? new Date(subscriber.unsubscribed_at).toLocaleDateString(
                                        "es-PY",
                                        { dateStyle: "medium" },
                                      )
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "management" && (
              <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Administración
                    </p>
                    <h2 className="text-2xl font-black text-foreground">
                      Panel editorial por artículo
                    </h2>
                  </div>
                  <div className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                    {articles.length} artículos
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <aside className="space-y-3 rounded-2xl border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Contenido
                      </h3>
                      <button
                        type="button"
                        onClick={handleCreateNew}
                        className="text-xs font-semibold text-primary"
                      >
                        + Nuevo
                      </button>
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as "all" | AdminArticle["status"])
                      }
                      className="mb-3 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                    >
                      <option value="all">Todos los estados</option>
                      <option value="draft">Borrador</option>
                      <option value="scheduled">Programado</option>
                      <option value="published">Publicado</option>
                      <option value="archived">Archivado</option>
                    </select>

                    {editorialQueue.length > 0 && (
                      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                            Cola de revisión
                          </p>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            {summary.reviewQueue}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {editorialQueue.map((article) => (
                            <div
                              key={article.id}
                              className="rounded-xl border border-amber-200 bg-white p-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="line-clamp-2 text-xs font-semibold text-slate-800">
                                  {article.title}
                                </span>
                                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] uppercase text-slate-700">
                                  {article.status}
                                </span>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleWorkflowChange(article.id, "published")}
                                  className="flex-1 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                                >
                                  Publicar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleWorkflowChange(article.id, "archived")}
                                  className="flex-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  Archivar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(filteredArticles.length === 0 ? [] : filteredArticles).map((article) => {
                      const stats = commentStatsByArticle.get(article.id) ?? { count: 0, likes: 0 };

                      return (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => {
                            setManagementArticleId(article.id);
                            setSelectedId(article.id);
                          }}
                          className={[
                            "w-full rounded-2xl border p-3 text-left transition",
                            managementArticleId === article.id
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border bg-background hover:bg-accent",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-2 text-sm font-bold text-foreground">
                              {article.title}
                            </span>
                            <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                              {article.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                            <span>Vistas {article.views_count}</span>
                            <span>Com. {stats.count}</span>
                            <span>Likes {stats.likes}</span>
                          </div>
                        </button>
                      );
                    })}
                  </aside>

                  <div className="space-y-6">
                    {!selectedManagementArticle ? (
                      <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                        Elegí un artículo para ver su rendimiento y moderar comentarios.
                      </div>
                    ) : (
                      (() => {
                        const selectedStats = commentStatsByArticle.get(
                          selectedManagementArticle.id,
                        ) ?? { count: 0, likes: 0 };

                        return (
                          <>
                            <div className="rounded-2xl border bg-background p-5">
                              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                                    Artículo seleccionado
                                  </p>
                                  <h3 className="mt-1 text-xl font-black text-foreground">
                                    {selectedManagementArticle.title}
                                  </h3>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedId(selectedManagementArticle.id);
                                    setActiveTab("articles");
                                  }}
                                  className="rounded-full border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                                >
                                  Editar artículo
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-2xl border bg-card p-3">
                                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    Vistas
                                  </div>
                                  <div className="mt-2 text-2xl font-black text-foreground">
                                    {selectedManagementArticle.views_count}
                                  </div>
                                </div>
                                <div className="rounded-2xl border bg-card p-3">
                                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    Comentarios
                                  </div>
                                  <div className="mt-2 text-2xl font-black text-foreground">
                                    {selectedStats.count}
                                  </div>
                                </div>
                                <div className="rounded-2xl border bg-card p-3">
                                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    Likes
                                  </div>
                                  <div className="mt-2 text-2xl font-black text-foreground">
                                    {selectedStats.likes}
                                  </div>
                                </div>
                                <div className="rounded-2xl border bg-card p-3">
                                  <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    Estado
                                  </div>
                                  <div className="mt-2 text-lg font-black text-primary">
                                    {selectedManagementArticle.status}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWorkflowChange(selectedManagementArticle.id, "draft")
                                  }
                                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50"
                                >
                                  En revisión
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWorkflowChange(selectedManagementArticle.id, "scheduled")
                                  }
                                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold uppercase text-amber-700 hover:bg-amber-100"
                                >
                                  Programar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWorkflowChange(selectedManagementArticle.id, "published")
                                  }
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase text-emerald-700 hover:bg-emerald-100"
                                >
                                  Publicar
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWorkflowChange(selectedManagementArticle.id, "archived")
                                  }
                                  className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase text-red-700 hover:bg-red-100"
                                >
                                  Archivar
                                </button>
                              </div>
                            </div>

                            <div className="rounded-2xl border bg-background p-5">
                              <div className="mb-4 flex items-center justify-between gap-3">
                                <h3 className="text-lg font-black text-foreground">
                                  Comentarios del artículo
                                </h3>
                                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                  {articleComments.length} en total
                                </span>
                              </div>

                              {articleCommentsLoading ? (
                                <div className="space-y-3">
                                  {Array.from({ length: 3 }).map((_, index) => (
                                    <div
                                      key={index}
                                      className="h-20 animate-pulse rounded-2xl bg-muted/70"
                                    />
                                  ))}
                                </div>
                              ) : articleComments.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                                  No hay comentarios en este artículo.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {articleComments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className="rounded-2xl border bg-card p-4"
                                    >
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                          <UserAvatar
                                            name={comment.author_name}
                                            avatarUrl={comment.author_avatar}
                                            sizeClass="h-10 w-10"
                                            textClass="text-[10px]"
                                            fallbackBg="bg-primary/10 text-primary"
                                          />
                                          <div>
                                            <p className="text-sm font-bold text-foreground">
                                              {comment.author_name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                              {new Date(comment.created_at).toLocaleString(
                                                "es-PY",
                                                { dateStyle: "medium", timeStyle: "short" },
                                              )}
                                            </p>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteComment(comment.id)}
                                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                                        {comment.body}
                                      </p>
                                      <div className="mt-3 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                        <span>Likes {comment.like_count}</span>
                                        <span>#{comment.id}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()
                    )}
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "categories" && (
              <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                        Categorías
                      </p>
                      <h2 className="text-2xl font-black text-foreground">Administrar secciones</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(null);
                        setCategoryForm({ name: "", slug: "", color: "#E33A2E", sort_order: 0 });
                      }}
                      className="rounded-full border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                    >
                      Nueva
                    </button>
                  </div>

                  <div className="space-y-3">
                    {adminCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Todavía no hay categorías creadas.
                      </p>
                    ) : (
                      adminCategories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border bg-background p-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-4 w-4 rounded-full border"
                              style={{ backgroundColor: category.color ?? "#E33A2E" }}
                            />
                            <div>
                              <p className="font-semibold text-foreground">{category.name}</p>
                              <p className="text-xs text-muted-foreground">/{category.slug}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(category.id);
                                setCategoryForm({
                                  name: category.name,
                                  slug: category.slug,
                                  color: category.color ?? "#E33A2E",
                                  sort_order: category.sort_order,
                                });
                              }}
                              className="rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteCategory(category.id);
                                await queryClient.invalidateQueries({
                                  queryKey: ["admin", "categories"],
                                });
                                await queryClient.invalidateQueries({ queryKey: ["categories"] });
                              }}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Editor
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-foreground">
                    {editingCategoryId ? "Editar categoría" : "Crear categoría"}
                  </h3>

                  <div className="mt-5 space-y-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-foreground">Nombre</span>
                      <input
                        value={categoryForm.name}
                        onChange={(event) =>
                          setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        placeholder="Política"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-foreground">Slug</span>
                      <input
                        value={categoryForm.slug}
                        onChange={(event) =>
                          setCategoryForm((prev) => ({ ...prev, slug: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        placeholder="politica"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-foreground">Color</span>
                        <input
                          type="color"
                          value={categoryForm.color || "#E33A2E"}
                          onChange={(event) =>
                            setCategoryForm((prev) => ({ ...prev, color: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-input bg-background p-1"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-foreground">Orden</span>
                        <input
                          type="number"
                          value={categoryForm.sort_order}
                          onChange={(event) =>
                            setCategoryForm((prev) => ({
                              ...prev,
                              sort_order: Number(event.target.value || 0),
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={categoryMutation.isPending}
                      onClick={() => categoryMutation.mutate()}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {categoryMutation.isPending
                        ? "Guardando…"
                        : editingCategoryId
                          ? "Guardar cambios"
                          : "Guardar categoría"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "tags" && (
              <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                        Etiquetas
                      </p>
                      <h2 className="text-2xl font-black text-foreground">Administrar etiquetas</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTagId(null);
                        setTagForm({ name: "", slug: "" });
                      }}
                      className="rounded-full border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                    >
                      Nueva
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {adminTags.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Todavía no hay etiquetas creadas.
                      </p>
                    ) : (
                      adminTags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5"
                        >
                          <span className="text-sm font-semibold text-foreground">#{tag.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagId(tag.id);
                              setTagForm({ name: tag.name, slug: tag.slug });
                            }}
                            className="text-[10px] font-bold uppercase text-primary"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteTag(tag.id);
                              await queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
                            }}
                            className="text-[10px] font-bold uppercase text-red-600"
                          >
                            X
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Editor
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-foreground">
                    {editingTagId ? "Editar etiqueta" : "Crear etiqueta"}
                  </h3>

                  <div className="mt-5 space-y-4">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-foreground">Nombre</span>
                      <input
                        value={tagForm.name}
                        onChange={(event) =>
                          setTagForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        placeholder="Innovación"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-foreground">Slug</span>
                      <input
                        value={tagForm.slug}
                        onChange={(event) =>
                          setTagForm((prev) => ({ ...prev, slug: event.target.value }))
                        }
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                        placeholder="innovacion"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={tagMutation.isPending}
                      onClick={() => tagMutation.mutate()}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {tagMutation.isPending
                        ? "Guardando…"
                        : editingTagId
                          ? "Guardar cambios"
                          : "Guardar etiqueta"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "authors" && (
              <section className="space-y-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Autores
                    </p>
                    <h2 className="text-2xl font-black text-foreground">Equipo editorial</h2>
                  </div>

                  <div className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                    {authorGroups.editorial.length} personas
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-3 sm:p-4">
                  <label className="flex items-center gap-3 rounded-2xl border border-input bg-white px-3 py-2.5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Buscar</span>
                    <input
                      value={authorSearchTerm}
                      onChange={(event) => setAuthorSearchTerm(event.target.value)}
                      placeholder="Nombre, rol o email..."
                      className="h-10 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                </div>

                <div className="rounded-3xl border bg-background p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                        Equipo editorial
                      </p>
                      <h3 className="text-xl font-black text-foreground">Autores</h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {authorGroups.editorial.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {authorGroups.editorial.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                        No hay usuarios con rol editorial para esta búsqueda.
                      </div>
                    ) : (
                      authorGroups.editorial.map((author) => (
                        <div
                          key={author.id}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)] md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={author.full_name}
                              avatarUrl={author.avatar_url}
                              sizeClass="h-11 w-11"
                              textClass="text-sm"
                              fallbackBg="bg-slate-900 text-white"
                            />
                            <div>
                              <p className="font-semibold text-foreground">
                                {author.full_name ?? "Usuario sin nombre"}
                              </p>
                              <p className="text-xs capitalize text-muted-foreground">
                                {author.role}
                              </p>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Rol
                            </span>
                            <select
                              value={author.role}
                              onChange={(event) =>
                                authorRoleMutation.mutate({
                                  id: author.id,
                                  role: event.target.value as "reader" | "editor" | "admin",
                                })
                              }
                              className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="reader">Reader</option>
                            </select>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            {visibleTab === "users" && (
              <section className="space-y-6 rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                      Usuarios
                    </p>
                    <h2 className="text-2xl font-black text-foreground">
                      Todos los usuarios registrados
                    </h2>
                  </div>

                  <div className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase text-muted-foreground">
                    {authors.length} personas
                  </div>
                </div>

                <div className="rounded-2xl border bg-background p-3 sm:p-4">
                  <label className="flex items-center gap-3 rounded-2xl border border-input bg-white px-3 py-2.5 shadow-sm">
                    <span className="text-sm font-medium text-muted-foreground">Buscar</span>
                    <input
                      value={userSearchTerm}
                      onChange={(event) => setUserSearchTerm(event.target.value)}
                      placeholder="Nombre, rol o email..."
                      className="h-10 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </label>
                </div>

                <div className="rounded-3xl border bg-background p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                        Registro
                      </p>
                      <h3 className="text-xl font-black text-foreground">
                        Google + Correo y contraseña
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {filteredUsers.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {filteredUsers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                        No hay usuarios registrados para esta búsqueda.
                      </div>
                    ) : (
                      filteredUsers.map((author) => (
                        <div
                          key={author.id}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,0.03)] md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={author.full_name}
                              avatarUrl={author.avatar_url}
                              sizeClass="h-11 w-11"
                              textClass="text-sm"
                              fallbackBg="bg-slate-900 text-white"
                            />
                            <div>
                              <p className="font-semibold text-foreground">
                                {author.full_name ?? "Usuario sin nombre"}
                              </p>
                              <p className="text-xs capitalize text-muted-foreground">
                                {author.role}
                              </p>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-sm text-foreground">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Rol
                            </span>
                            <select
                              value={author.role}
                              onChange={(event) =>
                                authorRoleMutation.mutate({
                                  id: author.id,
                                  role: event.target.value as "reader" | "editor" | "admin",
                                })
                              }
                              className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary"
                            >
                              <option value="reader">Reader</option>
                              <option value="editor">Editor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
