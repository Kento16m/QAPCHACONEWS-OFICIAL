// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertTargets, dollarQuote, planMigration, summarize } from "./transform.mjs";

const A1 = "a0000000-0000-0000-0000-000000000001";
const A2 = "a0000000-0000-0000-0000-000000000002";
const GONE = "a0000000-0000-0000-0000-00000000dead";
const U1 = "00000000-0000-0000-0000-000000000001";

const comment = (id, article_id, extra = {}) => ({
  id,
  article_id,
  user_id: U1,
  parent_id: null,
  body: `c${id}`,
  like_count: 7,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  status: "pending_review",
  moderation_score: null,
  moderation_reason: null,
  is_deleted: false,
  ...extra,
});

const source = (overrides = {}) => ({
  articles: [{ id: A1 }, { id: A2 }],
  comments: [],
  comment_likes: [],
  comment_moderation_events: [],
  comment_moderation_jobs: [],
  comment_rate_log: [],
  ...overrides,
});

const ids = (rows) => rows.map((row) => row.id);

describe("planMigration", () => {
  it("imports comments whose article exists", () => {
    const plan = planMigration(source({ comments: [comment(1, A1)] }));
    expect(ids(plan.comments)).toEqual([1]);
    expect(plan.archive).toEqual([]);
  });

  it("archives comments of articles that no longer exist, without losing them", () => {
    const plan = planMigration(source({ comments: [comment(1, A1), comment(2, GONE)] }));
    expect(ids(plan.comments)).toEqual([1]);
    expect(plan.archive).toEqual([
      { source_table: "comments", source_id: "2", reason: "article_missing", row: comment(2, GONE) },
    ]);
  });

  it("archives replies whose parent was not imported, however deep", () => {
    const plan = planMigration(
      source({
        comments: [
          comment(1, GONE),
          comment(2, A1, { parent_id: 1 }),
          comment(3, A1, { parent_id: 2 }),
          comment(4, A1),
          comment(5, A1, { parent_id: 4 }),
        ],
      }),
    );
    expect(ids(plan.comments).sort()).toEqual([4, 5]);
    expect(plan.archive.map((entry) => entry.source_id).sort()).toEqual(["1", "2", "3"]);
    expect(plan.archive.find((entry) => entry.source_id === "3")?.reason).toBe("parent_missing");
  });

  it("archives comments that the old site marked as removed", () => {
    const plan = planMigration(
      source({
        comments: [
          comment(1, A1, { is_deleted: true }),
          comment(2, A1, { status: "rejected" }),
          comment(3, A1, { status: "deleted" }),
          comment(4, A1, { status: "flagged" }),
          comment(5, A1, { status: "approved" }),
          comment(6, A1, { status: "pending_review" }),
        ],
      }),
    );
    expect(ids(plan.comments).sort()).toEqual([5, 6]);
    expect(plan.archive.every((entry) => entry.reason === "removed_by_moderation")).toBe(true);
  });

  it("keeps only the columns of the new table and lets real likes set the counter", () => {
    const plan = planMigration(source({ comments: [comment(1, A1)] }));
    expect(plan.comments[0]).toEqual({
      id: 1,
      article_id: A1,
      user_id: U1,
      parent_id: null,
      body: "c1",
      like_count: 0,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    });
  });

  it("imports likes of imported comments and archives the rest", () => {
    const like = (id, comment_id, user_id = U1) => ({ id, comment_id, user_id, created_at: "2026-10-01T00:00:00Z" });
    const plan = planMigration(
      source({ comments: [comment(1, A1), comment(2, GONE)], comment_likes: [like(10, 1), like(11, 2)] }),
    );
    expect(plan.comment_likes).toEqual([{ comment_id: 1, user_id: U1, created_at: "2026-10-01T00:00:00Z" }]);
    expect(plan.archive.find((entry) => entry.source_table === "comment_likes")?.source_id).toBe("11");
  });

  it("removes duplicate likes, which the new primary key would reject", () => {
    const like = (id) => ({ id, comment_id: 1, user_id: U1, created_at: "2026-10-01T00:00:00Z" });
    const plan = planMigration(source({ comments: [comment(1, A1)], comment_likes: [like(10), like(11)] }));
    expect(plan.comment_likes).toHaveLength(1);
    expect(plan.archive.find((entry) => entry.source_id === "11")?.reason).toBe("duplicate_like");
  });

  it("archives the old system's moderation history", () => {
    const plan = planMigration(
      source({
        comment_moderation_events: [{ id: 1, event_type: "moderation_failed" }],
        comment_moderation_jobs: [{ id: 2, status: "queued" }],
        comment_rate_log: [{ id: "x", user_id: U1 }],
      }),
    );
    expect(plan.archive.map((entry) => entry.source_table).sort()).toEqual([
      "comment_moderation_events",
      "comment_moderation_jobs",
      "comment_rate_log",
    ]);
  });

  it("accounts for every source row", () => {
    const data = source({
      comments: [comment(1, A1), comment(2, GONE), comment(3, A1, { is_deleted: true })],
      comment_likes: [{ id: 9, comment_id: 2, user_id: U1 }],
    });
    const plan = planMigration(data);
    expect(plan.comments.length + plan.archive.filter((e) => e.source_table === "comments").length).toBe(3);
    expect(summarize(plan)).toMatchObject({ comments: 1, archived: { comments: 2, comment_likes: 1 } });
  });
});

describe("dollarQuote", () => {
  it("wraps text so SQL cannot be injected through it", () => {
    const quoted = dollarQuote(`'); drop table articles; --`);
    const tag = quoted.match(/^\$[a-z0-9_]*\$/)?.[0];
    expect(tag).toBeTruthy();
    expect(quoted.startsWith(tag)).toBe(true);
    expect(quoted.endsWith(tag)).toBe(true);
  });

  it("never uses a tag that appears in the text", () => {
    const quoted = dollarQuote("contiene $q0$ dentro");
    const tag = quoted.match(/^\$[a-z0-9_]*\$/)?.[0];
    expect(quoted.slice(tag.length, -tag.length)).not.toContain(tag);
  });
});

describe("assertTargets", () => {
  const PROD = "nkkgwjvmdxggvyzehlzp";

  it("allows copying from production to another project", () => {
    expect(() => assertTargets({ source: PROD, target: "ooswoucakxnymtdblrzd", production: PROD })).not.toThrow();
  });

  it("refuses to write to production", () => {
    expect(() => assertTargets({ source: "x", target: PROD, production: PROD })).toThrow(/producción/);
  });

  it("refuses to copy a project onto itself", () => {
    expect(() => assertTargets({ source: "same", target: "same", production: PROD })).toThrow();
  });
});
