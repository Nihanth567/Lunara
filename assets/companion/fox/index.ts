import type { ImageSourcePropType } from 'react-native';
import type { CompanionState } from '@/lib/companion';

/**
 * The commissioned night fox, one image per state.
 *
 * ─── This file is the entire handoff ─────────────────────────────────────────
 *
 * It is empty on purpose. Until real art lands, `NightFoxArt` falls back to its
 * vector placeholder and the app is fully working — the state machine, the
 * placements, the motion and the copy are all already done and none of them
 * read this file for anything but a picture.
 *
 * When the commission arrives: drop the PNGs in this folder and uncomment the
 * lines below. That is the whole integration. Nothing else changes, no
 * component is rewritten, and a partial delivery is fine — any state without an
 * entry keeps using the placeholder, so the art can land one pose at a time.
 *
 * `require` rather than a dynamic path because Metro resolves asset requires at
 * bundle time; a computed filename silently ships nothing.
 */
export const FOX_ART: Partial<Record<CompanionState, ImageSourcePropType>> = {
  // nesting:   require('./nesting.png'),
  // waiting:   require('./waiting.png'),
  // ready:     require('./ready.png'),
  // glowing:   require('./glowing.png'),
  // streaklit: require('./streaklit.png'),
  // resting:   require('./resting.png'),
  // sleeping:  require('./sleeping.png'),
};
