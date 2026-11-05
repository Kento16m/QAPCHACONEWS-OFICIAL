// Only words that are insults in any context. Words with ordinary meanings ("perro", "pesado",
// "matar" in a news comment) are left to the AI moderation, which reads the whole sentence.
// The lookarounds replace \b, which treats accented letters as word breaks: it found "culo" in "artículo".
const BLOCKED_WORDS =
  /(?<![\p{L}\p{N}])(?:puta|puto|culo|idiota|imb[eé]cil|mierda|mierd[ae]|cabr[oó]n|hijo de puta|bastardo|pendej[oa]|cagada)(?![\p{L}\p{N}])/iu;

export const hasBlockedWord = (text: string) => BLOCKED_WORDS.test(text);
