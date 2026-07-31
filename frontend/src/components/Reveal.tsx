import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Scroll-entry motion that cannot hide anything.
 *
 * The usual implementation starts at `opacity: 0` and waits for an observer.
 * When that reveal fails to fire — backgrounded tab, throttled engine, a
 * hydration hiccup, a screenshot pass — the content is simply gone, and a
 * whole section renders as an empty void.
 *
 * So this animates transform only. Opacity stays at 1 for the entire life of
 * the element. If the animation never runs the page is still complete; the
 * content just does not slide. Motion is a courtesy here, never a gate.
 */
export const Reveal = ({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};
