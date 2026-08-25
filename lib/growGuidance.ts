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
 * Template matching for now, keyed off both partners' Grow text. Swap the
 * body of this function for an async call to an LLM later — the UI only
 * depends on this signature (an array of short strings in, up to three
 * GrowSuggestions out), so nothing else needs to change.
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
