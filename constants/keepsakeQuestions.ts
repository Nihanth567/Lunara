export interface KeepsakeQuestion {
  key: string;
  prompt: string;
  helper: string;
  icon: 'heart-outline' | 'sparkles-outline' | 'gift-outline' | 'images-outline' | 'moon-outline';
}

export const KEEPSAKE_QUESTIONS: KeepsakeQuestion[] = [
  {
    key: 'love_most',
    prompt: 'What do you love most about them?',
    helper: 'The thing that comes to mind first — no need to overthink it',
    icon: 'heart-outline',
  },
  {
    key: 'how_met',
    prompt: 'How did you two meet?',
    helper: 'Tell it the way you’d tell a close friend',
    icon: 'sparkles-outline',
  },
  {
    key: 'small_thing',
    prompt: 'What’s a small thing they do that makes you feel loved?',
    helper: 'Something easy to miss, but you never do',
    icon: 'gift-outline',
  },
  {
    key: 'favorite_memory',
    prompt: 'What’s one of your favorite memories together?',
    helper: 'A moment you’d want to keep forever',
    icon: 'images-outline',
  },
  {
    key: 'feel_closest',
    prompt: 'What makes you feel closest to them?',
    helper: 'Could be a moment, a place, or just an ordinary evening in',
    icon: 'moon-outline',
  },
];
