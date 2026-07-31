import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './components/ui/button';

/**
 * The instrument.
 *
 * This is the argument the product makes, made operable. A proof lands every
 * few seconds. By default you see what the chain sees: the root pulses, a
 * nullifier is published, and the sixteen commitments sit there telling you
 * nothing about which of them was responsible.
 *
 * Hold "reveal what happened" and the path traces from the actual leaf. The
 * gap between those two views is the product. The leaf is chosen before the
 * animation starts, so the public view genuinely cannot know it — the demo is
 * honest rather than staged.
 */

const LEAVES = 16;
const DEPTH = 4;
const W = 560;
const H = 340;

const MARGIN = 30;
const LEAF_Y = H - 66;
const ROOT_Y = 52;
const GAP = (W - MARGIN * 2) / (LEAVES - 1);

const leafX = (i: number): number => MARGIN + i * GAP;
const levelY = (d: number): number => LEAF_Y - ((LEAF_Y - ROOT_Y) * d) / DEPTH;

/** Occupied slots. Ten of sixteen, so the tree reads as partly filled. */
const OCCUPIED = [1, 2, 4, 5, 7, 8, 10, 11, 13, 14];

type Edge = { x1: number; y1: number; x2: number; y2: number };

const build = (): { edges: Edge[]; nodes: number[][] } => {
  const edges: Edge[] = [];
  const nodes: number[][] = [Array.from({ length: LEAVES }, (_, i) => leafX(i))];

  for (let d = 0; d < DEPTH; d += 1) {
    const cur = nodes[d] ?? [];
    const next: number[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      const a = cur[i] ?? 0;
      const b = cur[i + 1] ?? a;
      const mid = (a + b) / 2;
      edges.push({ x1: a, y1: levelY(d), x2: mid, y2: levelY(d + 1) });
      edges.push({ x1: b, y1: levelY(d), x2: mid, y2: levelY(d + 1) });
      next.push(mid);
    }
    nodes.push(next);
  }

  return { edges, nodes };
};

const { edges: EDGES, nodes: NODES } = build();

/** The chain of edges carrying one leaf up to the root. */
const pathFor = (leaf: number): Edge[] => {
  const out: Edge[] = [];
  let idx = leaf;
  for (let d = 0; d < DEPTH; d += 1) {
    out.push({
      x1: NODES[d]?.[idx] ?? 0,
      y1: levelY(d),
      x2: NODES[d + 1]?.[idx >> 1] ?? 0,
      y2: levelY(d + 1),
    });
    idx >>= 1;
  }
  return out;
};

/** A plausible-looking digest. Display only — nothing here is a real proof. */
const sampleNullifier = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

type Proof = { leaf: number; nullifier: string; id: number };

export const Plate = () => {
  const [proof, setProof] = useState<Proof | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const counter = useRef(0);
  const reduced = useReducedMotion();

  const fire = useCallback(() => {
    const leaf = OCCUPIED[Math.floor(Math.random() * OCCUPIED.length)] ?? 1;
    counter.current += 1;
    setProof({ leaf, nullifier: sampleNullifier(), id: counter.current });
  }, []);

  useEffect(() => {
    fire();
    // With reduced motion the instrument still shows a proof; it just stops
    // cycling. Nothing is lost, because nothing was hidden to begin with.
    if (reduced) return undefined;
    const timer = window.setInterval(fire, 4200);
    return () => window.clearInterval(timer);
  }, [fire, reduced]);

  const litPath = proof === undefined ? [] : pathFor(proof.leaf);

  return (
    <figure className="m-0 grid gap-[0.9rem]">
      {/* Outer tray. */}
      <div className="rounded-[20px] bg-ink-2 p-2 shadow-[inset_0_0_0_1px_var(--color-hair-soft)]">
        {/* Inner plate, seated in the tray with a single lit top edge. */}
        <div className="rounded-[13px] bg-linear-to-b from-ink-3 to-ink-2 p-4 shadow-[inset_0_0_0_1px_var(--color-hair),inset_0_1px_0_0_rgb(255_255_255/6%)] sm:p-6">
          <svg
            className="block h-auto w-full"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Sixteen membership commitments folding into a single Merkle root. A proof arrives; the public view never shows which commitment produced it."
          >
            {EDGES.map((e, i) => (
              <line
                key={`e${i}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                className="stroke-line"
                strokeWidth={1}
                strokeLinecap="round"
              />
            ))}

            {/*
              The traced path stays mounted and animates between states rather
              than mounting and unmounting. Two reasons: an exit animation left
              the lines in the tree after release, and a round linecap at
              pathLength 0 still paints a dot — so releasing scattered clay
              specks across the drawing. Animating a permanent element has
              neither problem, and opacity does the hiding.
            */}
            {revealed &&
              litPath.map((e, i) => (
                <line
                  key={`lit-${proof?.id}-${i}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  className="stroke-clay"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              ))}

            {Array.from({ length: LEAVES }, (_, i) => {
              const occupied = OCCUPIED.includes(i);
              const isSource = revealed && proof?.leaf === i;
              return (
                <rect
                  key={`l${i}`}
                  x={leafX(i) - 4.5}
                  y={LEAF_Y - 4.5}
                  width={9}
                  height={9}
                  rx={1.5}
                  strokeWidth={1}
                  className={
                    isSource
                      ? 'fill-[#2e2e2e] stroke-clay'
                      : occupied
                        ? 'fill-[#171717] stroke-line-lit'
                        : 'fill-none stroke-line'
                  }
                />
              );
            })}

            {/* The only movement an observer of the chain actually sees. */}
            <motion.circle
              key={`root-${proof?.id}`}
              cx={W / 2}
              cy={ROOT_Y}
              className="fill-[#141414] stroke-line-lit"
              strokeWidth={1.25}
              initial={{ r: 8 }}
              animate={reduced ? { r: 8 } : { r: [8, 11, 8] }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />

            <text x={W / 2} y={ROOT_Y - 20} textAnchor="middle" className="fill-bone-3 font-mono text-[9.5px]">
              root
            </text>
            <text x={MARGIN} y={H - 30} className="fill-bone-3 font-mono text-[9.5px]">
              16 commitments
            </text>
            <text x={W - MARGIN} y={H - 30} textAnchor="end" className="fill-bone-3 font-mono text-[9.5px]">
              0 identities
            </text>
          </svg>

          <div className="mt-[1.1rem] flex flex-wrap items-baseline justify-between gap-4 border-t border-hair-soft pt-[0.9rem]">
            <span className="font-mono text-[0.6875rem] tracking-[0.08em] text-bone-3 uppercase">
              nullifier published
            </span>
            <motion.output
              key={proof?.id}
              className="font-mono text-[0.8125rem] text-clay"
              initial={{ y: 3 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {proof === undefined ? '—' : `0x${proof.nullifier}…`}
            </motion.output>
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-4 px-[0.35rem] text-[0.8125rem] text-bone-3">
        <span>{revealed ? 'You are seeing the leaf. The chain never does.' : 'The public view.'}</span>
        <Button
          variant="outline"
          size="sm"
          className="touch-none"
          aria-pressed={revealed}
          onPointerDown={() => setRevealed(true)}
          onPointerUp={() => setRevealed(false)}
          onPointerLeave={() => setRevealed(false)}
          onKeyDown={(e) => e.key === 'Enter' && setRevealed(true)}
          onKeyUp={(e) => e.key === 'Enter' && setRevealed(false)}
        >
          hold to reveal what happened
        </Button>
      </figcaption>
    </figure>
  );
};
