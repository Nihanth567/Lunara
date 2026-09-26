/**
 * The photographs the onboarding funnel uses, named for what each one shows
 * rather than for the screen that first carried it.
 *
 * They are one set — the same couple, the same candlelit grade — which is the
 * reason to use these and not a fresh batch: a funnel whose pictures change
 * people halfway through reads as stock. Keep additions to the same couple and
 * the same light, or the set stops being a set.
 *
 * Each carries the sentence VoiceOver reads, so the picture is described rather
 * than skipped.
 */
export interface OnboardingPhotoAsset {
  source: number;
  label: string;
}

export const ONBOARDING_PHOTOS = {
  /** Two rooms, two phones, two smiles — answered apart. */
  apart: {
    source: require('./tutorial-2.jpg'),
    label: 'Two people in separate rooms at night, each smiling at their phone.',
  },
  /** Heads together over one phone — opened together. */
  together: {
    source: require('./tutorial-3.jpg'),
    label: 'A couple leaning in together, reading one phone by lamplight.',
  },
  /** Resting against each other, eyes closed — what closer looks like. */
  close: {
    source: require('./ob-benefits.jpg'),
    label: 'A couple resting against each other on a sofa, eyes closed, smiling.',
  },
  /** A phone lit up in the dark — something waiting for you. */
  glow: {
    source: require('./tutorial-1.jpg'),
    label: 'Hands holding a phone that lights up in the dark.',
  },
  /** Candlelight and a covered smile — the good part. */
  delight: {
    source: require('./ob-intro.jpg'),
    label: 'A couple by candlelight; she covers a smile as he shows her his phone.',
  },
} satisfies Record<string, OnboardingPhotoAsset>;
