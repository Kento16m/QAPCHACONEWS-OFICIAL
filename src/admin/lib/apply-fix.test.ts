import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { extensions } from "../editor/extensions";
import { applyFix } from "./apply-fix";

let editor: Editor;
const open = (content: string) => {
  editor = new Editor({ extensions, content });
  return editor;
};

afterEach(() => editor.destroy());

describe("applyFix", () => {
  it("changes exactly that text", () => {
    open("<p>El presidente hablo ayer.</p>");
    expect(applyFix(editor, "hablo", "habló")).toBe("applied");
    expect(editor.getHTML()).toBe("<p>El presidente habló ayer.</p>");
  });

  it("changes only the first place it appears", () => {
    open("<p>casa casa</p>");
    applyFix(editor, "casa", "caza");
    expect(editor.getHTML()).toBe("<p>caza casa</p>");
  });

  it("finds it in any paragraph", () => {
    open("<p>uno</p><h3>dos tres</h3>");
    applyFix(editor, "tres", "3");
    expect(editor.getHTML()).toContain("<p>uno</p><h3>dos 3</h3>");
  });

  it("works across bold text and keeps the bold where it does not change", () => {
    open("<p>la <strong>nota</strong> de hoy y <strong>mañana</strong></p>");
    expect(applyFix(editor, "mañana", "manana")).toBe("applied");
    expect(editor.getHTML()).toContain("<strong>manana</strong>");
    expect(applyFix(editor, "nota de", "noticia de")).toBe("applied");
    expect(editor.getText()).toContain("noticia de hoy");
  });

  it("touches nothing when the text already changed", () => {
    open("<p>Otro texto.</p>");
    expect(applyFix(editor, "hablo", "habló")).toBe("gone");
    expect(editor.getHTML()).toBe("<p>Otro texto.</p>");
  });

  it("does not match across two paragraphs", () => {
    open("<p>fin</p><p>inicio</p>");
    expect(applyFix(editor, "fin inicio", "x")).toBe("gone");
  });

  it("can be undone", () => {
    open("<p>hablo</p>");
    applyFix(editor, "hablo", "habló");
    editor.commands.undo();
    expect(editor.getHTML()).toBe("<p>hablo</p>");
  });
});
