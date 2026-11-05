import { describe, expect, it } from "vitest";
import { attentionItems, type AttentionInput } from "./attention";

const calm: AttentionInput = {
  homepage_open_slots: 0,
  stale_breaking: 0,
  stale_drafts: 0,
  scheduled_24h: 0,
  comments_24h: 0,
};
const ids = (input: Partial<AttentionInput>) =>
  attentionItems({ ...calm, ...input }).map((item) => item.id);

describe("attentionItems", () => {
  it("is empty when there is nothing to do", () => {
    expect(attentionItems(calm)).toEqual([]);
  });

  it.each([
    ["homepage", { homepage_open_slots: 2 }],
    ["breaking", { stale_breaking: 1 }],
    ["drafts", { stale_drafts: 3 }],
    ["scheduled", { scheduled_24h: 1 }],
    ["comments", { comments_24h: 4 }],
  ])("shows %s only when it applies", (id, input) => {
    expect(ids(input)).toEqual([id]);
  });

  it("does not report the homepage while its data does not exist yet", () => {
    expect(ids({ homepage_open_slots: null })).toEqual([]);
  });

  it("puts problems before information", () => {
    const items = attentionItems({
      homepage_open_slots: 1,
      stale_breaking: 1,
      stale_drafts: 1,
      scheduled_24h: 1,
      comments_24h: 1,
    });
    expect(items.map((item) => item.tone)).toEqual([
      "warning",
      "warning",
      "warning",
      "info",
      "info",
    ]);
  });

  it("carries the count and a singular title", () => {
    const [item] = attentionItems({ ...calm, stale_drafts: 1 });
    expect(item?.count).toBe(1);
    expect(item?.title).toBe("Borrador sin tocar");
  });

  it("uses the plural when there are several", () => {
    const [item] = attentionItems({ ...calm, stale_drafts: 2 });
    expect(item?.title).toBe("Borradores sin tocar");
  });
});
