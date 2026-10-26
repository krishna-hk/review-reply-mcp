// Quotes are always copied from the original review by code, never retyped by the AI.

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?\n]+(?:[.!?]+(?=\s|$)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s) out.push(s);
  }
  return out;
}

/** The shortest whole sentence, or the whole review if it is short enough. */
export function pickQuote(text: string, maxLength = 160): string | null {
  const clean = text.trim();
  if (clean === "") return null;
  if (clean.length <= maxLength) return clean;
  const fits = splitSentences(clean).filter((s) => s.length <= maxLength);
  if (fits.length === 0) return null;
  return fits.reduce((a, b) => (a.length >= b.length ? a : b));
}

/**
 * The AI may point at the sentence that backs a tag (counting from 0). Code copies that exact
 * sentence. Returns null if the number does not match a sentence, so a bad pointer can never invent text.
 */
export function quoteFromSentence(text: string, index: number): string | null {
  const s = splitSentences(text)[index];
  return s !== undefined && isExactQuote(text, s) ? s : null;
}

/** True only if the quote is an exact piece of the original text. */
export function isExactQuote(original: string, quote: string): boolean {
  return quote.trim() !== "" && original.includes(quote);
}
