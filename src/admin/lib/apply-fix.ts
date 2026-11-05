import type { Editor } from "@tiptap/core";

/**
 * Replaces the first place a text appears, inside one block. Returns "gone" and changes nothing
 * if the person already edited that part: an old suggestion must not overwrite newer writing.
 */
export const applyFix = (
  editor: Editor,
  original: string,
  replacement: string,
): "applied" | "gone" => {
  let range: { from: number; to: number } | null = null;

  editor.state.doc.descendants((node, position) => {
    if (range) return false;
    if (!node.isTextblock) return true;

    // Each character's place in the document, since marks and line breaks shift the count.
    let text = "";
    const places: number[] = [];
    node.descendants((child, offset) => {
      if (!child.isText) return;
      for (let index = 0; index < (child.text?.length ?? 0); index++) {
        places.push(position + 1 + offset + index);
      }
      text += child.text ?? "";
    });

    const start = text.indexOf(original);
    if (start >= 0) {
      range = { from: places[start]!, to: places[start + original.length - 1]! + 1 };
    }
    return false;
  });

  if (!range) return "gone";
  const { from, to } = range as { from: number; to: number };
  editor.view.dispatch(editor.state.tr.insertText(replacement, from, to));
  return "applied";
};
