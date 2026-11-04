import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import DOMPurify from "dompurify";
import { readFunctionError } from "@/lib/function-error";
import { ChevronDown, ChevronUp, Heart, LogIn, MessageSquare, MoreHorizontal, Reply, Send, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { getProfileColor } from "@/lib/profile-colors";
import { supabase } from "@/lib/supabase";

type CommentRecord = {
  id: number;
  article_id: string;
  user_id: string;
  parent_id: number | null;
  body: string;
  like_count: number;
  created_at: string;
};

type ProfileSummary = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  profile_color: string | null;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-PY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const sanitizeText = (value: string) =>
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();

const offensiveContentMessage = "Tu comentario no es apto para esta comunidad. Por favor, elimina palabras ofensivas o contenido inapropiado y vuelve a intentarlo.";
const rateLimitMessage = "Superaste el límite de mensajes. Por favor, esperá 1 minuto antes de comentar otra vez.";

const isOffensiveContentMessage = (message: string) =>
  /no es apto para esta comunidad|palabras ofensivas|contenido inapropiado|comentario fue bloqueado/i.test(message);

const isRateLimitMessage = (message: string) =>
  /límite|limite|espera 1 minuto|esperá 1 minuto|429|rate limit|too many requests/i.test(message);

const parseJsonStringCandidate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      const message =
        (parsed as Record<string, unknown>)["error"] ??
        (parsed as Record<string, unknown>)["message"] ??
        (parsed as Record<string, unknown>)["detail"] ??
        (parsed as Record<string, unknown>)["details"] ??
        null;

      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
  } catch {
    // Ignore invalid JSON and fall back to the raw text.
  }

  return trimmed;
};

const normalizeErrorMessage = (error: unknown): string => {
  if (typeof error === "string") {
    const raw = parseJsonStringCandidate(error) ?? error.trim();
    if (isOffensiveContentMessage(raw)) return offensiveContentMessage;
    if (isRateLimitMessage(raw)) return rateLimitMessage;
    return raw || "No se pudo publicar el comentario.";
  }

  if (error instanceof Error) {
    const raw = parseJsonStringCandidate(error.message) ?? (error.message || "No se pudo publicar el comentario.");
    if (isOffensiveContentMessage(raw)) return offensiveContentMessage;
    if (isRateLimitMessage(raw)) return rateLimitMessage;
    return raw;
  }

  if (error && typeof error === "object") {
    const details = error as Record<string, unknown>;
    const statusCode = typeof details["status"] === "number" ? details["status"] : null;
    const context = details["context"];

    if (statusCode === 429) {
      return rateLimitMessage;
    }

    const candidates: unknown[] = [
      details["message"],
      details["error"],
      details["detail"],
      details["details"],
      details["hint"],
      details["body"],
      details["data"],
      context,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const text = parseJsonStringCandidate(candidate) ?? candidate.trim();
        if (!text) continue;
        if (isOffensiveContentMessage(text)) return offensiveContentMessage;
        if (isRateLimitMessage(text)) return rateLimitMessage;
        return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;
        const nestedKeys = [
          nested["message"],
          nested["error"],
          nested["detail"],
          nested["details"],
          nested["hint"],
          nested["body"],
          nested["data"],
        ];

        for (const nestedValue of nestedKeys) {
          if (typeof nestedValue === "string") {
            const text = parseJsonStringCandidate(nestedValue) ?? nestedValue.trim();
            if (!text) continue;
            if (isOffensiveContentMessage(text)) return offensiveContentMessage;
            if (isRateLimitMessage(text)) return rateLimitMessage;
            return text;
          }
        }
      }
    }

    const jsonText = JSON.stringify(details);
    if (isOffensiveContentMessage(jsonText)) return offensiveContentMessage;
    if (isRateLimitMessage(jsonText)) return rateLimitMessage;
  }

  return "No se pudo publicar el comentario.";
};

const PAGE_SIZE = 10;

export function CommentsSection({ articleId }: { articleId: string }) {
  const { openAuthDialog } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyTargetName, setReplyTargetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageRef = useRef(page);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animatedLikes, setAnimatedLikes] = useState<Record<number, boolean>>({});
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [removingCommentIds, setRemovingCommentIds] = useState<Record<number, boolean>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const [visibleReplyCounts, setVisibleReplyCounts] = useState<Record<number, number>>({});
  const [sortMode, setSortMode] = useState<"popular" | "newest">("popular");

  const currentUser = session?.user ?? null;
  const currentUserId = currentUser?.id ?? null;
  const currentUserMeta = currentUser?.user_metadata ?? {};
  const currentUserDisplayName =
    currentUserMeta?.full_name ||
    currentUserMeta?.name ||
    currentUser?.email?.split("@")[0] ||
    "Usuario";
  const currentUserAvatar = currentUserMeta?.avatar_url || currentUserMeta?.picture || null;
  const isAuthenticated = Boolean(currentUserId && session?.access_token);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (highlightedCommentId === null) return;

    const timeout = window.setTimeout(() => {
      setHighlightedCommentId(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [highlightedCommentId]);

  const hydrateProfilesForComments = async (commentList: CommentRecord[]) => {
    const uniqueUserIds = [...new Set(commentList.map((comment) => comment.user_id))];
    if (uniqueUserIds.length === 0 || !supabase) return;

    const { data: profileRows, error: profileError } = await supabase
      .from("public_profiles")
      .select("id, full_name, avatar_url, profile_color")
      .in("id", uniqueUserIds);

    if (profileError) return;

    const nextProfiles = (profileRows ?? []).reduce<Record<string, ProfileSummary>>((acc, profile) => {
      if (!profile.id) return acc;
      acc[profile.id] = {
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        profile_color: profile.profile_color ?? getProfileColor(profile.full_name),
      };
      return acc;
    }, {});

    setProfiles((current) => ({ ...current, ...nextProfiles }));
  };

  const dedupeComments = (list: CommentRecord[]) => {
    const byId = new Map<number, CommentRecord>();
    list.forEach((comment) => {
      byId.set(comment.id, comment);
    });
    return [...byId.values()];
  };

  useEffect(() => {
    if (!supabase || !articleId) return;
    const client = supabase;

    const fetchComments = async (pageIndex = 0, append = false) => {
      if (pageIndex === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: fetchError } = await client
        .from("comments")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (fetchError) {
        setError("No se pudieron cargar los comentarios.");
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const nextComments = dedupeComments((data as CommentRecord[]) ?? []);

      setComments((current) => {
        const merged = append ? [...current, ...nextComments] : nextComments;
        return dedupeComments(merged);
      });
      setHasMore(nextComments.length === PAGE_SIZE);

      await hydrateProfilesForComments(nextComments);

      if (pageIndex === 0) {
        setProfiles((current) => {
          const next = { ...current };
          Object.keys(next).forEach((key) => {
            if (!nextComments.some((comment) => comment.user_id === key)) delete next[key];
          });
          return next;
        });
      }

      setLoading(false);
      setLoadingMore(false);
    };

    fetchComments(0, false);

    const commentsChannel = supabase.channel(`comments-${articleId}`);
    commentsChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `article_id=eq.${articleId}`,
        },
        () => {
          if (pageRef.current > 0) return;
          setPage(0);
          setComments([]);
          void fetchComments(0, false);
        }
      )
      .subscribe();

    return () => {
      commentsChannel.unsubscribe();
    };
  }, [articleId]);

  const handleReply = (commentId: number, authorName?: string) => {
    setReplyTo(commentId);
    setReplyTargetName(authorName || "");
    setDraft("");
    setError("");
  };

  const replyCounts = useMemo(() => {
    const counts = new Map<number, number>();

    comments.forEach((comment) => {
      if (comment.parent_id !== null) {
        counts.set(comment.parent_id, (counts.get(comment.parent_id) ?? 0) + 1);
      }
    });

    return counts;
  }, [comments]);

  const sortComments = (list: CommentRecord[]) =>
    [...list].sort((a, b) => {
      const aIsOwner = currentUserId === a.user_id ? 1 : 0;
      const bIsOwner = currentUserId === b.user_id ? 1 : 0;

      if (aIsOwner !== bIsOwner) return bIsOwner - aIsOwner;

      if (sortMode === "popular") {
        const aScore = a.like_count + (replyCounts.get(a.id) ?? 0) * 2;
        const bScore = b.like_count + (replyCounts.get(b.id) ?? 0) * 2;
        if (aScore !== bScore) return bScore - aScore;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const commentsByParent = useMemo(() => {
    const grouped: Record<number, CommentRecord[]> = {};

    for (const comment of sortComments(comments)) {
      if (comment.parent_id !== null) {
        (grouped[comment.parent_id] ??= []).push(comment);
      }
    }

    return Object.fromEntries(
      Object.entries(grouped).map(([parentId, items]) => [Number(parentId), sortComments(items)])
    );
  }, [comments, session, sortMode, replyCounts]);

  const rootComments = useMemo(
    () => sortComments(comments.filter((comment) => comment.parent_id === null)),
    [comments, session, sortMode, replyCounts]
  );

  const submitComment = async () => {
    if (!supabase) {
      setError("Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
      return;
    }

    if (!session?.access_token || !session?.user?.id) {
      setError("Tu sesión de Supabase está vencida o no está iniciada. Volvé a iniciar sesión para comentar.");
      return;
    }

    const cleanBody = sanitizeText(draft);
    if (cleanBody.length < 2 || cleanBody.length > 2000) {
      setError("Tu comentario debe tener entre 2 y 2000 caracteres.");
      return;
    }

    const optimisticComment: CommentRecord = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      article_id: articleId,
      user_id: session.user.id,
      parent_id: replyTo,
      body: cleanBody,
      like_count: 0,
      created_at: new Date().toISOString(),
    };

    setIsSubmitting(true);
    setError("");
    setComments((current) => {
      const withoutOptimistic = current.filter((item) => item.id !== optimisticComment.id);
      const next = dedupeComments([optimisticComment, ...withoutOptimistic]);
      return next.slice(0, Math.max(PAGE_SIZE, current.length + 1));
    });
    setHighlightedCommentId(optimisticComment.id);

    if (replyTo !== null) {
      setExpandedReplies((current) => ({ ...current, [replyTo]: true }));
      setVisibleReplyCounts((current) => ({
        ...current,
        [replyTo]: Math.max(current[replyTo] ?? 8, (commentsByParent[replyTo]?.length ?? 0) + 1),
      }));
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("moderate-comment", {
        body: {
          article_id: articleId,
          parent_id: replyTo,
          body: cleanBody,
        },
      });

      const functionError = await readFunctionError(invokeError);
      const payloadError =
        data && typeof data === "object" && "error" in data ? (data as { error?: unknown }).error : functionError.message;
      const payloadMessage = payloadError ? normalizeErrorMessage(payloadError) : normalizeErrorMessage(invokeError);

      if (payloadError || invokeError) {
        const statusCode = functionError.status;

        const authIssue =
          typeof invokeError === "object" &&
          invokeError !== null &&
          "message" in invokeError &&
          typeof invokeError.message === "string" &&
          /jwt|unauthorized|401|token/i.test(invokeError.message);

        const friendlyMessage = statusCode === 429 || isRateLimitMessage(payloadMessage)
          ? rateLimitMessage
          : isOffensiveContentMessage(payloadMessage)
            ? offensiveContentMessage
            : authIssue
              ? "La sesión de Supabase no es válida o expiró. Volvé a iniciar sesión e intentá nuevamente."
              : payloadMessage === "Edge Function returned a non-2xx status code"
                ? "No se pudo publicar el comentario. Intentalo nuevamente en unos segundos."
                : payloadMessage;

        // Nothing was published, so the comment shown while waiting must go; the draft stays to retry.
        setComments((current) => current.filter((item) => item.id !== optimisticComment.id));
        setError(friendlyMessage);
        setIsSubmitting(false);
        return;
      }

      if (data && typeof data === "object" && Object.keys(data as object).length === 0) {
        console.error("Supabase function returned empty payload:", data);
        setError("La función respondió vacía. Revisa los logs de Supabase.");
        setIsSubmitting(false);
        return;
      }

      const insertedComment = (data as { comment?: CommentRecord })?.comment;
      if (insertedComment) {
        setComments((current) => {
          const withoutOptimistic = current.filter((item) => item.id !== optimisticComment.id);
          const existing = withoutOptimistic.some((item) => item.id === insertedComment.id);
          if (existing) return dedupeComments(withoutOptimistic);
          const next = dedupeComments([insertedComment, ...withoutOptimistic]);
          return next;
        });
        setHighlightedCommentId(insertedComment.id);
      } else {
        setComments((current) => dedupeComments(current.filter((item) => item.id !== optimisticComment.id)));
      }

      setPage(0);
      setHasMore(true);
      setDraft("");
      setReplyTo(null);
      setReplyTargetName("");
      if (replyTo !== null) {
        setExpandedReplies((current) => ({ ...current, [replyTo]: true }));
      }
    } catch (invokeError) {
      setComments((current) => current.filter((item) => item.id !== optimisticComment.id));
      const message = normalizeErrorMessage(invokeError);
      setError(
        /jwt|unauthorized|401|token/i.test(message)
          ? "La sesión de Supabase no es válida o expiró. Volvé a iniciar sesión e intentá nuevamente."
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const likeComment = async (commentId: number) => {
    if (!supabase) {
      setError("La conexión con Supabase no está configurada.");
      return;
    }

    if (!session) {
      setError("Iniciá sesión para dar like.");
      return;
    }

    setAnimatedLikes((current) => ({ ...current, [commentId]: true }));
    window.setTimeout(() => {
      setAnimatedLikes((current) => ({ ...current, [commentId]: false }));
    }, 420);

    const { error: likeError } = await supabase.from("comment_likes").insert({
      comment_id: commentId,
      user_id: session.user.id,
    });

    if (likeError) {
      if (likeError.code === "23505") {
        setError("Ya diste like a este comentario.");
      } else {
        setError("No se pudo registrar el like.");
      }
      setAnimatedLikes((current) => ({ ...current, [commentId]: false }));
      return;
    }

    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, like_count: comment.like_count + 1 } : comment
      )
    );
    setError("");
  };

  const deleteComment = async (commentId: number) => {
    if (!supabase) return;
    if (!session) return;

    setDeleteTargetId(null);
    setRemovingCommentIds((current) => ({ ...current, [commentId]: true }));

    const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", session.user.id);
    if (error) {
      setRemovingCommentIds((current) => ({ ...current, [commentId]: false }));
      setError("No se pudo eliminar el comentario.");
      return;
    }

    window.setTimeout(() => {
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setRemovingCommentIds((current) => {
        const next = { ...current };
        delete next[commentId];
        return next;
      });
    }, 240);
  };

  if (!supabase) {
    return (
      <section className="mt-12 rounded-3xl border border-dashed border-muted-foreground/30 bg-card p-6 text-sm text-muted-foreground">
        Configura las variables de entorno de Supabase para activar comentarios.
      </section>
    );
  }

  return (
    <>
      <style>{`
        @keyframes heart-pop {
          0% { transform: scale(0.8); }
          30% { transform: scale(1.45); }
          55% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }

        @keyframes comment-pop {
          0% { transform: scale(0.96); opacity: 0.7; }
          35% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes publish-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          25% { transform: translateY(-2px) scale(1.02); }
          50% { transform: translateY(-5px) scale(1.05); }
          75% { transform: translateY(-1px) scale(1.02); }
        }

        @keyframes rotate-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .button {
          --primary: #ff5569;
          --neutral-1: #f7f8f7;
          --neutral-2: #e7e7e7;
          --radius: 14px;
          cursor: pointer;
          border-radius: var(--radius);
          text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
          border: none;
          box-shadow: 0 0.5px 0.5px 1px rgba(255, 255, 255, 0.2), 0 10px 20px rgba(0, 0, 0, 0.2), 0 4px 5px 0px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: all 0.3s ease;
          min-width: 164px;
          padding: 14px 18px;
          height: 52px;
          font-family: "Galano Grotesque", Poppins, Montserrat, sans-serif;
          font-style: normal;
          font-size: 17px;
          font-weight: 600;
          background: linear-gradient(var(--neutral-1), var(--neutral-2));
          color: var(--primary);
          overflow: hidden;
        }

        .button:hover {
          transform: scale(1.02);
          box-shadow: 0 0 1px 2px rgba(255, 255, 255, 0.3), 0 15px 30px rgba(0, 0, 0, 0.3), 0 10px 3px -3px rgba(0, 0, 0, 0.04);
        }

        .button:active {
          transform: scale(1);
          box-shadow: 0 0 1px 2px rgba(255, 255, 255, 0.3), 0 10px 3px -3px rgba(0, 0, 0, 0.2);
        }

        .button:after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: var(--radius);
          border: 2.5px solid transparent;
          background: linear-gradient(var(--neutral-1), var(--neutral-2)) padding-box,
            linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.45)) border-box;
          z-index: 0;
          transition: all 0.4s ease;
        }

        .button:hover::after {
          transform: scale(1.04, 1.08);
          box-shadow: inset 0 -1px 3px 0 rgba(255, 255, 255, 1);
        }

        .button::before {
          content: "";
          inset: 7px 6px 6px 6px;
          position: absolute;
          background: linear-gradient(to top, var(--neutral-1), var(--neutral-2));
          border-radius: 30px;
          filter: blur(0.5px);
          z-index: 2;
        }


        .state {
          padding-left: 29px;
          z-index: 2;
          display: flex;
          position: relative;
        }

        .state p {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }

        .state p span {
          display: block;
          opacity: 0;
          animation: slideDown 0.8s ease forwards calc(var(--i) * 0.03s);
          font-weight: 700;
          color: var(--primary);
        }

        .button:hover p span {
          opacity: 1;
          animation: wave 0.5s ease forwards calc(var(--i) * 0.02s);
        }

        .button:focus p span {
          opacity: 1;
          animation: disapear 0.6s ease forwards calc(var(--i) * 0.03s);
        }

        .state .icon {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          margin: auto;
          transform: scale(1.25);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .state .icon svg {
          overflow: visible;
        }

        @keyframes wave {
          30% {
            opacity: 1;
            transform: translateY(4px) translateX(0) rotate(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-3px) translateX(0) rotate(0);
            color: var(--primary);
          }
          100% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0);
          }
        }

        @keyframes slideDown {
          0% {
            opacity: 0;
            transform: translateY(-20px) translateX(5px) rotate(-90deg);
            color: var(--primary);
            filter: blur(5px);
          }
          30% {
            opacity: 1;
            transform: translateY(4px) translateX(0) rotate(0);
            filter: blur(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-3px) translateX(0) rotate(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0);
          }
        }

        @keyframes disapear {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
            transform: translateX(5px) translateY(20px);
            color: var(--primary);
            filter: blur(5px);
          }
        }

        .state--default .icon svg {
          animation: land 0.6s ease forwards;
        }

        .button:hover .state--default .icon {
          transform: rotate(45deg) scale(1.25);
        }

        .button:focus .state--default svg {
          animation: takeOff 0.8s linear forwards;
        }

        .button:focus .state--default .icon {
          transform: rotate(0) scale(1.25);
        }

        @keyframes takeOff {
          0% {
            opacity: 1;
          }
          60% {
            opacity: 1;
            transform: translateX(70px) rotate(45deg) scale(2);
          }
          100% {
            opacity: 0;
            transform: translateX(160px) rotate(45deg) scale(0);
          }
        }

        @keyframes land {
          0% {
            transform: translateX(-60px) translateY(30px) rotate(-50deg) scale(2);
            opacity: 0;
            filter: blur(3px);
          }
          100% {
            transform: translateX(0) translateY(0) rotate(0);
            opacity: 1;
            filter: blur(0);
          }
        }

        .state--default .icon:before {
          content: "";
          position: absolute;
          top: 50%;
          height: 2px;
          width: 0;
          left: -5px;
          background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.5));
        }

        .button:focus .state--default .icon:before {
          animation: contrail 0.8s linear forwards;
        }

        @keyframes contrail {
          0% {
            width: 0;
            opacity: 1;
          }
          8% {
            width: 15px;
          }
          60% {
            opacity: 0.7;
            width: 80px;
          }
          100% {
            opacity: 0;
            width: 160px;
          }
        }

        .state--sent {
          display: none;
        }

        .state--sent svg {
          transform: scale(1.25);
          margin-right: 8px;
        }

        .button:focus .state--default {
          position: absolute;
        }

        .button:focus .state--sent {
          display: flex;
        }

        .button:focus .state--sent span {
          opacity: 0;
          animation: slideDown 0.8s ease forwards calc(var(--i) * 0.2s);
        }

        .button:focus .state--sent .icon svg {
          opacity: 0;
          animation: appear 1.2s ease forwards 0.8s;
        }

        @keyframes appear {
          0% {
            opacity: 0;
            transform: scale(4) rotate(-40deg);
            color: var(--primary);
            filter: blur(4px);
          }
          30% {
            opacity: 1;
            transform: scale(0.6);
            filter: blur(1px);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="max-w-md rounded-[24px] border border-border bg-white p-6 shadow-[0_25px_60px_rgba(15,23,42,0.18)]">
          <AlertDialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">¿Eliminar comentario?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-600">
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 sm:justify-end">
            <AlertDialogCancel onClick={() => setDeleteTargetId(null)} className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTargetId !== null) {
                  void deleteComment(deleteTargetId);
                }
              }}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="mt-6 rounded-[28px] border border-[#ececf5] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:mt-12 sm:p-6">
        <div className="mb-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#5b4de6]" />
            <h3 className="text-[1.55rem] font-black tracking-[-0.04em] text-slate-900 sm:text-[2rem]">Comentarios</h3>
          </div>

          <div className="flex w-full items-center gap-1 rounded-full border border-[#e8e5f7] bg-[#f7f7fb] p-1 sm:w-auto">
            {(["popular", "newest"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSortMode(option)}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition-all sm:flex-none sm:px-4 sm:text-sm ${
                  sortMode === option
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {option === "popular" ? "Popular" : "Más recientes"}
              </button>
            ))}
          </div>
        </div>

        {!session ? (
          <div className="rounded-[26px] border border-dashed border-[#e8e5f7] bg-[#f9f9fd] p-5 text-center">
            <p className="mb-3 text-sm text-slate-600">Debés iniciar sesión para publicar o responder comentarios.</p>
            <Button variant="default" onClick={() => openAuthDialog("login")} className="rounded-xl bg-[#5b4de6] text-white hover:bg-[#4d40d8]">
              <LogIn className="h-4 w-4" /> Iniciar sesión
            </Button>
          </div>
        ) : (
          !replyTo && (
            <div className="mb-6 flex flex-col gap-3 rounded-[24px] border border-[#eceaf8] bg-[#f7f7fb] p-3 shadow-[inset_0_0_0_1px_rgba(91,77,230,0.03)] sm:flex-row sm:items-center">
              {session?.user?.user_metadata?.["avatar_url"] || session?.user?.user_metadata?.["picture"] ? (
                <img
                  src={session.user.user_metadata.avatar_url || session.user.user_metadata.picture}
                  alt={session.user.user_metadata.full_name || session.user.email || "Usuario"}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white sm:h-11 sm:w-11"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5b4de6] text-xs font-bold text-white sm:h-11 sm:w-11 sm:text-sm">
                  {(session.user.user_metadata.full_name || session.user.email || "U")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part: string) => part[0]?.toUpperCase() ?? "")
                    .join("") || "U"}
                </div>
              )}

              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribí tu comentario..."
                maxLength={2000}
                rows={1}
                className="min-h-[52px] flex-1 resize-none border-0 bg-transparent text-base text-slate-900 shadow-none placeholder:text-slate-500 focus-visible:ring-0"
              />

              <Button
                type="button"
                disabled={isSubmitting || !draft.trim()}
                onClick={submitComment}
                className="h-12 w-full rounded-2xl bg-[#5b4de6] p-0 text-white shadow-[0_12px_30px_rgba(91,77,230,0.38)] transition-all hover:bg-[#4d40d8] disabled:cursor-not-allowed disabled:opacity-60 sm:w-12 sm:min-w-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )
        )}

        {error && <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[22px] bg-slate-100" />
            ))}
          </div>
        ) : rootComments.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#e8e5f7] bg-[#f9f9fd] p-6 text-center text-sm text-slate-500">
            Todavía no hay comentarios. ¡Sé el primero en comentar!
          </div>
        ) : (
          <div className="space-y-0">
            {rootComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                children={commentsByParent[comment.id] ?? []}
                childrenMap={commentsByParent}
                session={session}
                profiles={profiles}
                onReply={handleReply}
                onLike={likeComment}
                onDelete={(commentId) => setDeleteTargetId(commentId)}
                animatedLikes={animatedLikes}
                highlighted={highlightedCommentId === comment.id}
                depth={0}
                replyTo={replyTo}
                replyTargetName={replyTargetName}
                draft={draft}
                onDraftChange={setDraft}
                onCancelReply={() => {
                  setReplyTo(null);
                  setReplyTargetName("");
                  setDraft("");
                }}
                onSubmitReply={submitComment}
                isSubmitting={isSubmitting}
                expandedReplies={expandedReplies}
                visibleReplyCounts={visibleReplyCounts}
                onToggleReplies={(commentId) => {
                  setExpandedReplies((current) => ({ ...current, [commentId]: !current[commentId] }));
                }}
                onLoadMoreReplies={(commentId) => {
                  setVisibleReplyCounts((current) => ({
                    ...current,
                    [commentId]: (current[commentId] ?? 8) + 8,
                  }));
                }}
                removingCommentIds={removingCommentIds}
              />
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (!supabase) return;
                    const nextPage = page + 1;
                    setPage(nextPage);
                    setLoadingMore(true);
                    const from = nextPage * PAGE_SIZE;
                    const to = from + PAGE_SIZE - 1;

                    const { data, error: fetchError } = await supabase
                      .from("comments")
                      .select("*")
                      .eq("article_id", articleId)
                      .order("created_at", { ascending: false })
                      .range(from, to);

                    if (fetchError) {
                      setError("No se pudieron cargar más comentarios.");
                      setLoadingMore(false);
                      return;
                    }

                    const more = (data as CommentRecord[]) ?? [];
                    if (more.length > 0) {
                      await hydrateProfilesForComments(more);
                    }
                    setComments((current) => [...current, ...more]);
                    setHasMore(more.length === PAGE_SIZE);
                    setLoadingMore(false);
                  }}
                  disabled={loadingMore}
                  className="rounded-full border-[#e8e5f7] bg-[#f7f7fb] px-5 py-2 text-sm font-medium text-slate-700 hover:bg-[#f1f1fb]"
                >
                  {loadingMore ? "Cargando..." : "Cargar más"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function CommentThread({
  comment,
  children,
  childrenMap,
  session,
  profiles,
  onReply,
  onLike,
  onDelete,
  animatedLikes,
  highlighted,
  depth,
  replyTo,
  replyTargetName,
  draft,
  onDraftChange,
  onCancelReply,
  onSubmitReply,
  isSubmitting,
  expandedReplies,
  visibleReplyCounts,
  onToggleReplies,
  onLoadMoreReplies,
  removingCommentIds,
}: {
  comment: CommentRecord;
  children: CommentRecord[];
  childrenMap: Record<number, CommentRecord[]>;
  session: Session | null;
  profiles: Record<string, ProfileSummary>;
  onReply: (id: number, authorName?: string) => void;
  onLike: (id: number) => void;
  onDelete: (id: number) => void;
  animatedLikes: Record<number, boolean>;
  highlighted?: boolean;
  depth: number;
  replyTo: number | null;
  replyTargetName: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onCancelReply: () => void;
  onSubmitReply: () => void;
  isSubmitting: boolean;
  expandedReplies: Record<number, boolean>;
  visibleReplyCounts: Record<number, number>;
  onToggleReplies: (id: number) => void;
  onLoadMoreReplies: (id: number) => void;
  removingCommentIds: Record<number, boolean>;
}) {
  const safeBody = sanitizeText(comment.body);
  const profile = profiles[comment.user_id];
  const sessionUserMeta = session?.user?.user_metadata ?? {};
  const profileFallbackName =
    profile?.full_name?.trim() ||
    (comment.user_id === session?.user?.id
      ? sessionUserMeta.full_name || sessionUserMeta.name || session?.user?.email?.split("@")[0]
      : null) ||
    "Usuario";
  const avatarUrl =
    profile?.avatar_url ||
    (comment.user_id === session?.user?.id
      ? sessionUserMeta.avatar_url || sessionUserMeta.picture || null
      : null);
  const authorName = profileFallbackName;
  const initials = authorName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
  const profileColor = profile?.profile_color ?? getProfileColor(authorName);
  const isAnimating = Boolean(animatedLikes[comment.id]);
  const isRemoving = Boolean(removingCommentIds[comment.id]);
  const isRepliesExpanded = Boolean(expandedReplies[comment.id]);
  const visibleReplyLimit = visibleReplyCounts[comment.id] ?? 8;
  const visibleChildren = children.slice(0, visibleReplyLimit);
  const hasMoreReplies = children.length > visibleReplyLimit;

  return (
    <div
      className={`relative rounded-[24px] border bg-white p-3 transition-all duration-300 sm:p-4 ${
        highlighted ? "border-[#5b4de6]/30 shadow-[0_0_0_2px_rgba(91,77,230,0.12)] animate-[comment-pop_0.7s_ease-out]" : "border-[#eef0f8]"
      } ${isRemoving ? "comment-card-removing" : ""}`}
      style={{ marginLeft: depth > 0 ? `${depth * 18}px` : 0 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={authorName} className="h-10 w-10 rounded-full object-cover ring-2 ring-[#f0f1f8] sm:h-11 sm:w-11" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[#f0f1f8] sm:h-11 sm:w-11 sm:text-sm"
              style={{ backgroundColor: profileColor }}
            >
              {initials}
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-slate-900">{authorName}</p>
            <p className="text-xs text-slate-500">{formatDate(comment.created_at)}</p>
          </div>
        </div>

        {session?.user?.id === comment.user_id && (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Eliminar comentario"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-slate-700 sm:leading-7" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(safeBody) }} />

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onReply(comment.id, authorName)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <Reply className="h-4 w-4" />
          <span>Responder</span>
        </button>

        <button
          type="button"
          onClick={() => onLike(comment.id)}
          className={`ml-auto inline-flex items-center gap-2 rounded-full border border-[#eceaf8] bg-[#f7f7fb] px-3 py-1.5 text-sm font-medium text-slate-700 transition-all ${
            isAnimating ? "scale-110 shadow-[0_0_18px_rgba(239,68,68,0.2)]" : "hover:scale-[1.02]"
          }`}
        >
          <Heart
            className={`h-4 w-4 ${isAnimating ? "fill-red-500 text-red-500" : "text-slate-700"}`}
            style={isAnimating ? { animation: "heart-pop 0.45s ease-in-out" } : undefined}
          />
          <span>{comment.like_count}</span>
        </button>
      </div>

      {session && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            replyTo === comment.id ? "mt-4 max-h-[420px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="rounded-[20px] border border-[#eceaf8] bg-[#f9f9fd] p-3 shadow-[inset_0_0_0_1px_rgba(91,77,230,0.02)]">
            <div className="mb-2 text-xs font-medium text-slate-500">Respondiendo a {replyTargetName || "este comentario"}</div>
            <Textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Escribí tu respuesta..."
              rows={3}
              maxLength={2000}
              className="min-h-[90px] resize-none border-0 bg-white text-sm placeholder:text-slate-400 focus-visible:ring-0"
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={onCancelReply} className="w-full rounded-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto">
                Cancelar
              </Button>
              <Button type="button" size="sm" disabled={isSubmitting || !draft.trim()} onClick={onSubmitReply} className="w-full rounded-full bg-[#5b4de6] text-white hover:bg-[#4d40d8] sm:w-auto">
                <Send className="h-4 w-4" /> Responder
              </Button>
            </div>
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onToggleReplies(comment.id)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b4de6] transition-transform hover:translate-x-0.5"
          >
            {isRepliesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>{isRepliesExpanded ? `Ocultar ${children.length} respuestas` : `Ver ${children.length} respuesta${children.length === 1 ? "" : "s"}`}</span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-400 ease-out ${
              isRepliesExpanded ? "mt-3 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-3 border-l border-[#eceaf8] pl-3">
              {visibleChildren.map((child) => (
                <CommentThread
                  key={child.id}
                  comment={child}
                  children={childrenMap[child.id] ?? []}
                  childrenMap={childrenMap}
                  session={session}
                  profiles={profiles}
                  onReply={onReply}
                  onLike={onLike}
                  onDelete={onDelete}
                  animatedLikes={animatedLikes}
                  depth={depth + 1}
                  replyTo={replyTo}
                  replyTargetName={replyTargetName}
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onCancelReply={onCancelReply}
                  onSubmitReply={onSubmitReply}
                  isSubmitting={isSubmitting}
                  expandedReplies={expandedReplies}
                  visibleReplyCounts={visibleReplyCounts}
                  onToggleReplies={onToggleReplies}
                  onLoadMoreReplies={onLoadMoreReplies}
                  removingCommentIds={removingCommentIds}
                />
              ))}
            </div>

            {hasMoreReplies && isRepliesExpanded && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onLoadMoreReplies(comment.id)}
                  className="rounded-full border border-[#e8e5f7] bg-[#f7f7fb] px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f1f1fb]"
                >
                  Cargar más
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
