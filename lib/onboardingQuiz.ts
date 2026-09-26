/**
 * The first-run quiz: its questions, and the few sentences the answers change.
 *
 * ─── Why a quiz at all ───────────────────────────────────────────────────────
 *
 * The paywall now sits at the end of onboarding, and a paywall shown to
 * someone who has spent two minutes telling you about their relationship
 * converts better than one shown to a stranger. That is the whole case for the
 * questions. Most of them do not change the product, and this file is honest
 * about that.
 *
 * ─── The rule every line below follows ───────────────────────────────────────
 *
 * An answer may shape a *sentence*; it never quietly changes the product, so no
 * line here may claim the app did something it doesn't do. "Voice notes ready"
 * is allowed because voice notes exist. "Pacing it for three nights a week" is
 * not, because nothing paces anything. The answers stay on this device
 * (`hooks/useOnboardingFunnel.ts`) and nothing in the ritual reads them.
 *
 * Pure and dependency-free so it can be tested: lib/onboardingQuiz.test.ts.
 */

export type NightFeel = 'soft' | 'playful' | 'honest';
export type Stage = 'dating' | 'living' | 'distance' | 'married';
export type Struggle = 'busy' | 'texting' | 'soft_words' | 'small_fights';
export type Rhythm = 'nightly' | 'few' | 'weekends';
export type Meaning = 'voice' | 'gratitude' | 'cute' | 'grow';
export type Together = 'new' | 'early' | 'settled' | 'long';
export type Barrier = 'forget' | 'awkward' | 'partner' | 'words';

export interface QuizAnswers {
  stage?: Stage;
  struggle?: Struggle;
  rhythm?: Rhythm;
  meaning?: Meaning;
  together?: Together;
  barrier?: Barrier;
}

export type QuizKey = keyof QuizAnswers;

export interface QuizOption {
  id: string;
  label: string;
  /** An Ionicons glyph name. Kept as a string so this file needs no React Native. */
  icon: string;
}

export interface QuizQuestion {
  key: QuizKey;
  title: string;
  options: QuizOption[];
  /** Shows a quiet "Skip this one" under the options. */
  optional?: boolean;
}

/** The one choice on the meet-your-fox screen. */
export const NIGHT_FEELS: { id: NightFeel; label: string; detail: string; icon: string }[] = [
  { id: 'soft', label: 'Soft', detail: 'Quiet and cosy', icon: 'cloud-outline' },
  { id: 'playful', label: 'Playful', detail: 'Light, a little silly', icon: 'balloon-outline' },
  { id: 'honest', label: 'Honest', detail: 'Real, but gentle', icon: 'heart-circle-outline' },
];

export const QUESTIONS: QuizQuestion[] = [
  {
    key: 'stage',
    title: 'Where are you two right now?',
    options: [
      { id: 'dating', label: 'Dating', icon: 'heart-outline' },
      { id: 'living', label: 'Living together', icon: 'home-outline' },
      { id: 'distance', label: 'Long-distance', icon: 'airplane-outline' },
      { id: 'married', label: 'Married', icon: 'infinite-outline' },
    ],
  },
  {
    key: 'struggle',
    title: 'What’s been hardest lately?',
    options: [
      { id: 'busy', label: 'We get busy', icon: 'time-outline' },
      { id: 'texting', label: 'We text, but don’t really talk', icon: 'chatbubbles-outline' },
      { id: 'soft_words', label: 'Soft things are hard to say', icon: 'heart-half-outline' },
      { id: 'small_fights', label: 'Small stuff turns into fights', icon: 'cloudy-outline' },
    ],
  },
  {
    key: 'rhythm',
    title: 'How often would you like a night together?',
    options: [
      { id: 'nightly', label: 'Every night', icon: 'moon-outline' },
      { id: 'few', label: 'A few times a week', icon: 'calendar-outline' },
      { id: 'weekends', label: 'Weekends', icon: 'sunny-outline' },
    ],
  },
  {
    key: 'meaning',
    title: 'What would mean the most?',
    options: [
      { id: 'voice', label: 'Hearing their voice', icon: 'mic-outline' },
      { id: 'gratitude', label: 'Feeling appreciated', icon: 'heart-outline' },
      { id: 'cute', label: 'The cute little moments', icon: 'happy-outline' },
      { id: 'grow', label: 'Growing without a fight', icon: 'leaf-outline' },
    ],
  },
  {
    key: 'together',
    title: 'How long have you been together?',
    optional: true,
    options: [
      { id: 'new', label: 'Less than a year', icon: 'sparkles-outline' },
      { id: 'early', label: '1–3 years', icon: 'flower-outline' },
      { id: 'settled', label: '3–10 years', icon: 'leaf-outline' },
      { id: 'long', label: 'More than 10 years', icon: 'infinite-outline' },
    ],
  },
  {
    key: 'barrier',
    title: 'What usually gets in the way?',
    options: [
      { id: 'forget', label: 'We forget', icon: 'alarm-outline' },
      { id: 'awkward', label: 'It feels a bit awkward', icon: 'chatbubble-ellipses-outline' },
      { id: 'partner', label: 'Getting my partner on board', icon: 'people-outline' },
      { id: 'words', label: 'Not knowing what to say', icon: 'help-circle-outline' },
    ],
  },
];

/**
 * The line under "You're already doing more than most couples", answering the
 * thing they said was hardest. Gentle, never a promise of a fix.
 */
export function beliefLine(answers: QuizAnswers): string {
  switch (answers.struggle) {
    case 'busy':
      return 'Three minutes fits inside even the busiest day.';
    case 'texting':
      return 'Texting keeps you in touch. This is for actually hearing each other.';
    case 'soft_words':
      return 'Soft things are easier to say when you both say them at once.';
    case 'small_fights':
      return 'Starting with something kind is a softer way into the rest of the night.';
    default:
      return 'A few quiet minutes, just for the two of you.';
  }
}

/**
 * The checklist on "Building your first night…". Four lines, each one true of
 * the product: the questions are real, voice notes exist, Grow tips really do
 * wait for the reveal, the reminder is only mentioned when it is actually on.
 */
export function nightPlanSteps(answers: QuizAnswers, opts: { remindersOn: boolean }): string[] {
  const meaning = (() => {
    switch (answers.meaning) {
      case 'voice':
        return 'Voice notes ready — you can say it out loud';
      case 'gratitude':
        return 'Grateful goes first, every night';
      case 'cute':
        return 'Saving a card for the cute little moments';
      case 'grow':
        return 'Keeping Grow gentle — tips only after you’ve both opened the night';
      default:
        return 'Setting out Grateful, Cute and Grow';
    }
  })();

  const barrier = (() => {
    switch (answers.barrier) {
      case 'forget':
        return opts.remindersOn
          ? 'One gentle reminder each night'
          : 'A nightly reminder you can turn on any time in Us';
      case 'partner':
        return 'An invite your partner can open in one tap';
      case 'words':
        return 'A new question every night, so there’s always a way in';
      case 'awkward':
      default:
        return 'Three short questions — nothing to prepare';
    }
  })();

  return ['Picking tonight’s three questions', meaning, barrier, 'Waking your fox'];
}

/** One line on the plan card, from where they are as a couple. */
export function planFraming(answers: QuizAnswers): string {
  switch (answers.stage) {
    case 'dating':
      return 'For the early days — the small things you’ll want to remember.';
    case 'living':
      return 'For the evenings under one roof, when you still want to really hear each other.';
    case 'distance':
      return 'For the miles in between. Answer from anywhere, open together.';
    case 'married':
      return 'For the long run — a small ritual that stays just yours.';
    default:
      return 'A small ritual that’s just yours.';
  }
}

/**
 * How often they hoped for, answered without pretending the app paces itself.
 * The fox really does rest between nights rather than sulk — that is what the
 * `resting` state is for.
 */
export function rhythmLine(answers: QuizAnswers): string {
  switch (answers.rhythm) {
    case 'few':
      return 'A few nights a week is a lovely rhythm. Your fox rests in between, and never sulks.';
    case 'weekends':
      return 'Weekends are a lovely place to start. Your fox will be there when you are.';
    case 'nightly':
      return 'Every night is a lovely goal. Three minutes makes it one you can keep.';
    default:
      return 'Three minutes, whenever the night allows.';
  }
}

/** The small summary chips on the plan card — only for what they actually answered. */
export function planChips(answers: QuizAnswers, feel?: NightFeel): string[] {
  const chips: string[] = [];
  const feelLabel = NIGHT_FEELS.find((f) => f.id === feel)?.label;
  if (feelLabel) chips.push(`${feelLabel} nights`);
  for (const key of ['rhythm', 'stage'] as const) {
    const id = answers[key];
    const label = QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.id === id)?.label;
    if (label) chips.push(label);
  }
  return chips;
}
