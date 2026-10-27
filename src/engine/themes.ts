export type Theme = string;
export type Sentiment = "positive" | "negative";

export interface ThemeDef {
  name: string;
  /** One line telling the tagger what counts, and what does not. */
  description: string;
  /** Optional umbrella group used to roll counts up in the digest. */
  group?: string;
}

/** Always present, always last. Spam and anything that fits nothing else goes here. */
export const OTHER = "Other";
export const OTHER_DEF: ThemeDef = { name: OTHER, description: "Anything that fits none of the themes above. Never beside another tag for the same point." };

export const MIN_THEMES = 3;
export const MAX_THEMES = 15;

const NAME = /^[A-Za-z0-9][A-Za-z0-9 ,&'/()+.-]{1,39}$/;
const LINE = /^[^\n\r<>`]{1,160}$/;
const GROUP = /^[A-Za-z0-9][A-Za-z0-9 ,&'/()+.-]{1,29}$/;

/**
 * Checks a theme list in code. The names go into the tagging prompt, so they are kept plain:
 * short, no markup, no line breaks. "Other" is added by us and cannot be redefined.
 */
export function validateThemeDefs(raw: unknown): { ok: true; themes: ThemeDef[] } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const list = Array.isArray(raw) ? raw : [];
  const themes: ThemeDef[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const o = (item ?? {}) as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const description = typeof o.description === "string" ? o.description.trim() : "";
    const group = typeof o.group === "string" && o.group.trim() ? o.group.trim() : undefined;
    if (name.toLowerCase() === OTHER.toLowerCase()) continue;
    if (!NAME.test(name)) {
      problems.push(`theme name "${name}" must be 2 to 40 plain characters (letters, numbers, spaces and , & ' / ( ) + . -)`);
      continue;
    }
    if (!LINE.test(description)) {
      problems.push(`theme "${name}" needs a one-line description of up to 160 characters, with no line breaks, < > or backticks`);
      continue;
    }
    if (group !== undefined && !GROUP.test(group)) {
      problems.push(`group "${group}" for theme "${name}" must be 2 to 30 plain characters`);
      continue;
    }
    if (seen.has(name.toLowerCase())) {
      problems.push(`theme "${name}" appears twice`);
      continue;
    }
    seen.add(name.toLowerCase());
    themes.push({ name, description, ...(group ? { group } : {}) });
  }
  if (themes.length < MIN_THEMES) problems.push(`give at least ${MIN_THEMES} themes (not counting Other)`);
  if (themes.length > MAX_THEMES) problems.push(`give at most ${MAX_THEMES} themes (not counting Other); merge similar ones`);
  if (problems.length) return { ok: false, problems };
  return { ok: true, themes: [...themes, OTHER_DEF] };
}

export function themeNames(defs: readonly ThemeDef[]): string[] {
  return defs.map((d) => d.name);
}

/** Group name to the themes in it, from the user's own theme list. Themes without a group are left out. */
export function groupMap(defs: readonly ThemeDef[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of defs) if (d.group) (out[d.group] ??= []).push(d.name);
  return out;
}
