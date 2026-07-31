import Lenis from 'lenis';
import { useEffect } from 'react';

/**
 * Smooth scrolling, which this layout leans on rather than decorates: the page
 * is a long editorial read and the chapter index jumps between anchors.
 *
 * Disabled outright when the reader has asked for reduced motion. Momentum
 * scrolling is exactly what that setting exists to refuse, and overriding the
 * scrollbar past a stated preference is hostile.
 *
 * The rAF loop is cancelled and the instance destroyed on unmount, or the page
 * keeps a second animation loop running forever after navigation.
 */
export const useLenis = (): void => {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.9 });
    let frame = 0;

    const raf = (time: number): void => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);
};
