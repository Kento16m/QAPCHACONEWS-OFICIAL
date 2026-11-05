// Decides what happens to each source row. Nothing is dropped: what has no place in the new tables is archived.
const REMOVED_STATUSES = new Set(["rejected", "deleted", "flagged"]);
const TABLES_NOT_IN_NEW_SCHEMA = [
  "comment_moderation_events",
  "comment_moderation_jobs",
  "comment_rate_log",
  "comment_rate_limits",
  "article_views",
  "site_settings",
  "homepage_sections",
];

const archived = (source_table, source_id, reason, row) => ({
  source_table,
  source_id: String(source_id),
  reason,
  row,
});

export const planMigration = (source) => {
  const articleIds = new Set(source.articles.map((article) => article.id));
  const archive = [];
  const kept = new Map();

  for (const comment of source.comments) {
    if (comment.is_deleted || REMOVED_STATUSES.has(comment.status)) {
      archive.push(archived("comments", comment.id, "removed_by_moderation", comment));
    } else if (!articleIds.has(comment.article_id)) {
      archive.push(archived("comments", comment.id, "article_missing", comment));
    } else {
      kept.set(comment.id, comment);
    }
  }

  // A reply needs its parent, and removing one parent can orphan a whole thread.
  for (let changed = true; changed;) {
    changed = false;
    for (const comment of kept.values()) {
      if (comment.parent_id !== null && !kept.has(comment.parent_id)) {
        kept.delete(comment.id);
        archive.push(archived("comments", comment.id, "parent_missing", comment));
        changed = true;
      }
    }
  }

  // The counter starts at zero: importing the likes raises it, so it always matches them.
  const comments = [...kept.values()].map(
    ({ id, article_id, user_id, parent_id, body, created_at, updated_at }) => ({
      id,
      article_id,
      user_id,
      parent_id,
      body,
      like_count: 0,
      created_at,
      updated_at,
    }),
  );

  const seenLikes = new Set();
  const comment_likes = [];
  for (const like of source.comment_likes) {
    const key = `${like.comment_id}:${like.user_id}`;
    if (!kept.has(like.comment_id)) {
      archive.push(archived("comment_likes", like.id, "comment_not_imported", like));
    } else if (seenLikes.has(key)) {
      archive.push(archived("comment_likes", like.id, "duplicate_like", like));
    } else {
      seenLikes.add(key);
      comment_likes.push({
        comment_id: like.comment_id,
        user_id: like.user_id,
        created_at: like.created_at,
      });
    }
  }

  for (const table of TABLES_NOT_IN_NEW_SCHEMA) {
    for (const row of source[table] ?? []) {
      archive.push(archived(table, row.id ?? row.key, "not_in_new_schema", row));
    }
  }

  return { comments, comment_likes, archive };
};

export const summarize = ({ comments, comment_likes, archive }) => ({
  comments: comments.length,
  comment_likes: comment_likes.length,
  archived: archive.reduce((totals, entry) => {
    totals[entry.source_table] = (totals[entry.source_table] ?? 0) + 1;
    return totals;
  }, {}),
});

// Article text is user content: a dollar-quoted literal keeps it from ever being read as SQL.
export const dollarQuote = (text) => {
  let n = 0;
  while (text.includes(`$q${n}$`)) n += 1;
  return `$q${n}$${text}$q${n}$`;
};

export const assertTargets = ({ source, target, production }) => {
  if (target === production) throw new Error("La producción solo se lee: no puede ser el destino.");
  if (source === target) throw new Error("El origen y el destino no pueden ser el mismo proyecto.");
};

// After the switch the target holds real data, and this copy would replace it.
export const assertNotCutOver = (rows) => {
  if (rows.length > 0) throw new Error("Ya se hizo el cambio: esta copia borraría datos reales.");
};
