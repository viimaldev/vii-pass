import type { ReactElement } from 'react';

/**
 * Ring geometry: 10 round dots evenly spaced on a circle (36° apart), starting
 * at the top and proceeding clockwise. Opacity fades from the head dot (1.0)
 * to the tail (~0.15), matching the dotted-spinner motif from the supplied
 * `loading.svg` artwork (recreated inline; the reference file was removed —
 * see specs/016-loading-spinner/research.md Decision 1).
 */
const DOTS: ReadonlyArray<{ cx: number; cy: number; opacity: number }> = Array.from(
  { length: 10 },
  (_, i) => {
    const angle = ((i * 36 - 90) * Math.PI) / 180;
    return {
      cx: Number((12 + 9 * Math.cos(angle)).toFixed(2)),
      cy: Number((12 + 9 * Math.sin(angle)).toFixed(2)),
      // Linear fade 1.0 → 0.15 across the ring's ten dots.
      opacity: Number((1 - i * (0.85 / 9)).toFixed(2)),
    };
  },
);

interface SpinnerProps {
  /**
   * Visual variant (specs/016-loading-spinner/contracts/spinner-ui.md §2):
   * - `'page'`   — ~36px indicator for viewport-centered page waits.
   * - `'button'` — 1em indicator rendered inline before a busy button label.
   */
  size?: 'page' | 'button';
}

/**
 * The app's single loading indicator (specs/016-loading-spinner): a circular
 * ring of ten dots with graduated opacity, rotated by CSS (see the `.spinner`
 * block in styles/tokens.css; rotation stops under prefers-reduced-motion).
 *
 * Purely decorative: hidden from the accessibility tree — every call site
 * keeps its own textual loading status for assistive technology (FR-005).
 * Dots use `currentColor`, so the spinner inherits the surrounding text color
 * in both themes and stays visible under forced colors (FR-006).
 */
export function Spinner({ size = 'button' }: SpinnerProps): ReactElement {
  return (
    <svg
      className={`spinner spinner--${size}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {DOTS.map((dot) => (
        <circle
          key={`${dot.cx}-${dot.cy}`}
          cx={dot.cx}
          cy={dot.cy}
          r="1.8"
          fill="currentColor"
          opacity={dot.opacity}
        />
      ))}
    </svg>
  );
}
