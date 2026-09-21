import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, View, type ViewStyle } from 'react-native';
import { Canvas, PaintStyle, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { MODE_FRAMES, resolvePreset, type OrbSize, type OrbState } from 'thinking-orbs/engine';
import { palette } from '@/constants/colors';

/**
 * Vendored from thinking-orbs' own React Native port
 * (github.com/Jakubantalik/thinking-orbs, `ports/react-native/`, MIT) rather
 * than depended on directly — that port is source-only, not published to npm.
 * `thinking-orbs` itself (the `/engine` import below) *is* published and is a
 * real dependency: this file only translates its frame output into Skia draw
 * calls, exactly as upstream's own component does. See that repo for the
 * nine states, the parity-verification scripts, and the full design rationale
 * quoted in the comments below.
 *
 * ─── Why monochrome, unmodified ──────────────────────────────────────────────
 *
 * The engine is "strictly monochrome" by design — light ink on dark, dark ink
 * on light, nothing else — and exposes no tint. That is respected here rather
 * than hacked around: `theme` is passed explicitly (never `'auto'`) since
 * Lunara is dark-mode-only regardless of the OS appearance, which is exactly
 * the case upstream's own docs call out as needing an explicit override.
 * `LunaraButton`'s existing light/dark-ink-by-variant logic maps onto this
 * prop precisely. Two call sites in this app color-code their spinner to a
 * caller-supplied accent (`VoiceNoteRecorder`, `VoiceNotePlayer`) — the orb is
 * deliberately not used there; forcing monochrome into a spot whose color
 * carries meaning would be a regression, not a upgrade.
 *
 * ─── Threading (upstream's own rationale, verified true here too) ───────────
 *
 * The frame is built and recorded into an `SkPicture` on the JS thread; Skia
 * rasterises it on the UI thread. The heaviest mode (`composing`, ~566 dots)
 * costs a fraction of a millisecond per frame — the geometry is deliberately
 * *not* workletized, since doing so would require `'worklet'` directives
 * throughout the shared engine package, which isn't ours to modify.
 * Rasterisation — the part that actually must not jank — is on the UI thread
 * either way.
 *
 * ─── Dependency note ──────────────────────────────────────────────────────────
 *
 * `@shopify/react-native-skia` requires `react-native-worklets >= 0.7` to
 * register its TurboModule correctly under React Native 0.81's New
 * Architecture — an older Skia avoids that peer requirement but fails to link
 * at runtime here. `react-native-worklets` was bumped from `0.5.1` (this
 * project's original pin) to `0.7.4` for that reason — the smallest version
 * that satisfies Skia's requirement, chosen deliberately over jumping to the
 * newest `0.8.x` release, and verified against every existing
 * Reanimated-based animation in the app (see the worklets-upgrade audit) since
 * that bump is a project-wide native runtime change, not one scoped to this
 * component.
 */

export type ThinkingOrbState = OrbState;
export type ThinkingOrbSize = OrbSize;

export interface ThinkingOrbProps {
  /** Which animation to show. */
  state?: ThinkingOrbState;
  /** Tuned size preset — 64 or 20 dp; not a scale factor, each is its own design. */
  size?: ThinkingOrbSize;
  /** Lunara is dark-mode-only — pass explicitly per call site, never `'auto'`. */
  theme: 'dark' | 'light';
  /** Speed multiplier on top of the preset's baked speed. */
  speed?: number;
  /** Freeze on the current frame. */
  paused?: boolean;
  /** Overrides the per-state default (e.g. "Pairing…" instead of "Connecting…"). */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const LABELS: Record<OrbState, string> = {
  working: 'Working…',
  searching: 'Searching…',
  solving: 'Solving…',
  listening: 'Listening…',
  connecting: 'Connecting…',
  weaving: 'Weaving…',
  composing: 'Composing…',
  breathing: 'Thinking…',
  shaping: 'Shaping…',
};

/** The static frame reduced-motion users see — same instant as the web/upstream. */
const REDUCED_MOTION_T = 0.6;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** True while the app is foregrounded — the render loop stops otherwise. */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * One clock for every orb on screen, so several mounted together stay in
 * phase — matches upstream's web build, which reads the shared
 * `performance.now`. Seconds since an arbitrary fixed origin.
 */
function nowSeconds(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof perf?.now === 'function' ? perf.now() / 1000 : Date.now() / 1000;
}

/**
 * Is there a Skia to draw with?
 *
 * On native there always is. On web, `@shopify/react-native-skia` needs its
 * CanvasKit WASM binary loaded before `Skia` has any methods on it, and this
 * project does not set that up — so `Skia.Paint()` threw `Cannot read
 * properties of undefined (reading 'Paint')` and took the whole app down at
 * the entry gate, inside the very first component the router renders.
 *
 * A loading indicator is the last thing in an app that should be capable of
 * crashing it. This is checked once at module load rather than per render:
 * the answer cannot change at runtime, and a component that is mounted during
 * startup should not pay for the question.
 */
const SKIA_AVAILABLE =
  Platform.OS !== 'web' &&
  typeof (Skia as { Paint?: unknown } | undefined)?.Paint === 'function';

/**
 * What draws when Skia can't.
 *
 * Three dots on a staggered fade — deliberately not an attempt to reproduce
 * the orb. Approximating 566 Skia-drawn dots with Views would be slower than
 * the thing it replaces and still wouldn't match. This says "working" honestly
 * in the engine's own monochrome register and costs three `Animated.Value`s.
 */
function FallbackOrb({ size, dark }: { size: number; dark: boolean }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  const dot = Math.max(3, Math.round(size * 0.13));
  // The engine is strictly monochrome: light ink on dark, dark ink on light.
  const ink = dark ? palette.ink[0] : palette.content[0];

  return (
    <View
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Math.round(dot * 0.7),
      }}
    >
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: ink,
            opacity: v,
          }}
        />
      ))}
    </View>
  );
}

export function ThinkingOrb({
  state = 'working',
  size = 64,
  theme,
  speed = 1,
  paused = false,
  accessibilityLabel,
  style,
}: ThinkingOrbProps) {
  const dark = theme === 'dark';
  const reduced = useReducedMotion();
  const appActive = useAppActive();

  const [picture, setPicture] = useState<SkPicture | null>(null);

  // One paint per pass, mutated in place: a fresh SkPaint per dot would
  // allocate ~600 native objects a frame, which is what actually hurts on
  // low-end Android.
  const paints = useMemo(
    () => (SKIA_AVAILABLE ? { fill: Skia.Paint(), stroke: Skia.Paint() } : null),
    [],
  );
  const rgba = useRef(new Float32Array(4)).current;

  const { mode, speed: baseSpeed, opts } = useMemo(() => resolvePreset(state, size), [state, size]);
  const effSpeed = baseSpeed * speed;

  useEffect(() => {
    if (!paints) return;
    const { fill, stroke } = paints;
    fill.setAntiAlias(true);
    stroke.setAntiAlias(true);
    stroke.setStyle(PaintStyle.Stroke);

    const build = MODE_FRAMES[mode];

    const setInk = (paint: typeof fill, white: number, alpha: number) => {
      const w = Math.min(1, Math.max(0, white));
      // Quantise to 8-bit exactly as the canvas painter does, so this lands
      // on the same greys as the web build rather than merely close ones.
      const g = Math.round((dark ? 1 - w : w) * 255) / 255;
      rgba[0] = g;
      rgba[1] = g;
      rgba[2] = g;
      rgba[3] = alpha;
      paint.setColor(rgba);
    };

    const record = (t: number) => {
      const frame = build(size, t, opts);
      const pic = createPicture((canvas) => {
        // lines first, so nodes sit on top of their edges
        for (const l of frame.lines) {
          setInk(stroke, l.white, l.a ?? 1);
          stroke.setStrokeWidth(l.w);
          canvas.drawLine(l.x1, l.y1, l.x2, l.y2, stroke);
        }
        // dots are already z-sorted into draw order by the engine
        for (const d of frame.dots) {
          setInk(fill, d.white, d.a ?? 1);
          canvas.drawCircle(d.x, d.y, d.r, fill);
        }
      }, Skia.XYWHRect(0, 0, size, size));
      setPicture(pic);
    };

    if (reduced) {
      record(REDUCED_MOTION_T);
      return;
    }

    // draw once even when paused or backgrounded, so the orb is never blank
    record(nowSeconds() * effSpeed);
    if (paused || !appActive) return;

    let raf = 0;
    let running = true;
    const loop = () => {
      record(nowSeconds() * effSpeed);
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [mode, opts, size, dark, effSpeed, paused, reduced, appActive, paints, rgba]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? LABELS[state]}
      style={[{ width: size, height: size }, style]}
    >
      {SKIA_AVAILABLE ? (
        <Canvas style={{ width: size, height: size }}>
          {picture ? <Picture picture={picture} /> : null}
        </Canvas>
      ) : (
        <FallbackOrb size={size} dark={dark} />
      )}
    </View>
  );
}
