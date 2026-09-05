export interface GrowSuggestion {
  id: string;
  text: string;
}

interface ThemeDefinition {
  key: string;
  keywords: string[];
  suggestions: GrowSuggestion[];
}

const THEMES: ThemeDefinition[] = [
  {
    key: 'time-together',
    keywords: ['time', 'busy', 'together', 'present', 'phone', 'distracted', 'attention', 'schedule'],
    suggestions: [
      { id: 'time-1', text: 'Pick one evening this week with no phones — even just for dinner.' },
      { id: 'time-2', text: 'Try a ten-minute walk together before bed, no agenda, just company.' },
      { id: 'time-3', text: 'Block a recurring hour each week that’s just for the two of you.' },
    ],
  },
  {
    key: 'communication',
    keywords: ['communicat', 'talk', 'listen', 'open up', 'share', 'honest', 'express', 'quiet', 'silent'],
    suggestions: [
      { id: 'comm-1', text: 'Try starting one hard conversation with "I’ve been feeling…" instead of "you always."' },
      { id: 'comm-2', text: 'Set aside five minutes tonight to just ask, "How are you, really?" — and listen.' },
      { id: 'comm-3', text: 'Naming what’s bothering you early tends to soften it more than waiting does.' },
    ],
  },
  {
    key: 'affection',
    keywords: ['affection', 'touch', 'hug', 'kiss', 'physical', 'close', 'cuddle', 'intimacy', 'romance'],
    suggestions: [
      { id: 'aff-1', text: 'A ten-second hug releases more warmth than it seems like it should — try one tonight.' },
      { id: 'aff-2', text: 'Leave a small note somewhere they’ll find it tomorrow.' },
      { id: 'aff-3', text: 'Sit a little closer than usual tonight, even just for a few minutes.' },
    ],
  },
  {
    key: 'stress',
    keywords: ['stress', 'tired', 'exhaust', 'overwhelm', 'anxious', 'work', 'burnout', 'pressure'],
    suggestions: [
      { id: 'stress-1', text: 'Ask what would actually feel like support this week — sometimes it’s help, sometimes it’s just space.' },
      { id: 'stress-2', text: 'Trade off one small task this week that’s been weighing on one of you.' },
      { id: 'stress-3', text: 'A calm five minutes together before sleep can undo a lot of a hard day.' },
    ],
  },
  {
    key: 'appreciation',
    keywords: ['apprecia', 'notice', 'thank', 'grateful', 'acknowledge', 'effort', 'unseen', 'unnoticed'],
    suggestions: [
      { id: 'appr-1', text: 'Name one specific thing they did this week that you noticed, out loud.' },
      { id: 'appr-2', text: 'A genuine "thank you for that" for something small can land bigger than expected.' },
    ],
  },
];

const GENERAL_SUGGESTIONS: GrowSuggestion[] = [
  { id: 'gen-1', text: 'Revisit tonight’s Grow note tomorrow and see if one small step comes to mind.' },
  { id: 'gen-2', text: 'Growth rarely needs a big gesture — a small, kind one usually does more.' },
  { id: 'gen-3', text: 'Just naming this tonight, together, already counts as movement.' },
];

/**
 * Offline fallback: keyword matching over both partners' Grow text. This is
 * what shows if the edge function is missing, unconfigured, slow, or failing —
 * `fetchGrowGuidance` below always has this to fall back to, which is why a
 * guidance failure is never visible to a couple.
 */
export function getGrowGuidance(growTexts: string[]): GrowSuggestion[] {
  const combined = growTexts.join(' ').toLowerCase();
  const matched = THEMES.filter((theme) => theme.keywords.some((kw) => combined.includes(kw)));

  const pool = matched.length > 0 ? matched.flatMap((theme) => theme.suggestions) : GENERAL_SUGGESTIONS;

  const seen = new Set<string>();
  const unique = pool.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  return unique.slice(0, 3);
}

// ─── Edge-function guidance ──────────────────────────────────────────────────

/** Where a rendered set of suggestions came from. Useful in dev; not surfaced in the UI. */
export type GuidanceSource = 'ai' | 'template';

export interface GuidanceResult {
  suggestions: GrowSuggestion[];
  source: GuidanceSource;
}

/** Give up on the model well before a couple would notice a card sitting empty. */
const GUIDANCE_TIMEOUT_MS = 12000;

/**
 * Coerce whatever the function returned into at most three well-formed
 * suggestions. Anything malformed is dropped rather than rendered, so a bad
 * model response degrades to the templates instead of painting an empty or
 * half-built card.
 *
 * Exported for tests — the shape guard is the part most worth pinning down.
 */
export function normalizeSuggestions(raw: unknown): GrowSuggestion[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { suggestions?: unknown })?.suggestions)
      ? ((raw as { suggestions: unknown[] }).suggestions)
      : [];

  return list
    .filter((s): s is { id?: unknown; text: string } =>
      Boolean(s) && typeof (s as { text?: unknown }).text === 'string' && (s as { text: string }).text.trim().length > 0)
    .slice(0, 3)
    .map((s, i) => ({
      id: typeof s.id === 'string' && s.id.trim() ? s.id : `ai-${i}`,
      text: s.text.trim(),
    }));
}

/**
 * How the edge function gets called. Injectable so the fallback behaviour can
 * be exercised directly; the default pulls in the Supabase client lazily,
 * which also keeps this module loadable outside React Native.
 */
export type GuidanceInvoker = (
  notes: string[],
) => Promise<{ data: unknown; error: unknown }>;

const defaultInvoker: GuidanceInvoker = async (notes) => {
  const { supabase } = await import('@/lib/supabase');
  return supabase.functions.invoke<{ suggestions?: unknown }>('grow-guidance', {
    body: { growTexts: notes },
  });
};

/**
 * Ask the `grow-guidance` edge function for suggestions, falling back to the
 * local templates on any failure — no key, no network, a timeout, a non-2xx,
 * or a response we can't make sense of. Always resolves; never throws.
 */
export async function fetchGrowGuidance(
  growTexts: string[],
  invoke: GuidanceInvoker = defaultInvoker,
): Promise<GuidanceResult> {
  const fallback: GuidanceResult = { suggestions: getGrowGuidance(growTexts), source: 'template' };

  const notes = growTexts.map((t) => (t ?? '').trim()).filter(Boolean);
  if (notes.length === 0) return fallback;

  try {
    const { data, error } = await withTimeout(invoke(notes), GUIDANCE_TIMEOUT_MS);

    if (error) {
      logGuidanceIssue('edge function returned an error', error);
      return fallback;
    }

    const suggestions = normalizeSuggestions(data);
    if (suggestions.length === 0) {
      logGuidanceIssue('edge function returned no usable suggestions', null);
      return fallback;
    }
    return { suggestions, source: 'ai' };
  } catch (err) {
    logGuidanceIssue('edge function call failed', err);
    return fallback;
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`grow-guidance timed out after ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Dev-only breadcrumb. The message is deliberately short and never includes the
 * couple's Grow text — those notes are the most private thing in the app, and a
 * degraded suggestion card is not worth logging them for.
 */
function logGuidanceIssue(what: string, err: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const detail = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  console.warn(`[grow-guidance] ${what}${detail ? `: ${detail}` : ''} — using template suggestions.`);
}
