import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The instrument.
 *
 * This is the argument the whole product makes, made operable. A proof lands
 * every few seconds. By default you see what the chain sees: the root pulses,
 * a nullifier appears, and the sixteen commitments sit there telling you
 * nothing about which of them was responsible.
 *
 * Then you can hold down "reveal what happened" and watch the path light up
 * from the actual leaf. The gap between those two views is the product. It is
 * a real control over real state, not a decorative loop -- the leaf is chosen
 * before the animation starts and the observer view genuinely cannot see it.
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

type Edge = { x1: number; y1: number; x2: number; y2: number; depth: number };

/** Every edge of the tree, and the x of each node at each level. */
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
      edges.push({ x1: a, y1: levelY(d), x2: mid, y2: levelY(d + 1), depth: d });
      edges.push({ x1: b, y1: levelY(d), x2: mid, y2: levelY(d + 1), depth: d });
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
    const from = NODES[d]?.[idx] ?? 0;
    const to = NODES[d + 1]?.[idx >> 1] ?? 0;
    out.push({ x1: from, y1: levelY(d), x2: to, y2: levelY(d + 1), depth: d });
    idx >>= 1;
  }
  return out;
};

/** A plausible-looking 32-byte digest, for display only. */
const fakeNullifier = (): string => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

type Proof = { leaf: number; nullifier: string; id: number };

export const Plate = () => {
  const [proof, setProof] = useState<Proof | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const counter = useRef(0);

  const fire = useCallback(() => {
    const leaf = OCCUPIED[Math.floor(Math.random() * OCCUPIED.length)] ?? 1;
    counter.current += 1;
    setProof({ leaf, nullifier: fakeNullifier(), id: counter.current });
  }, []);

  useEffect(() => {
    // Respect the user's motion preference by simply not running the loop.
    // The instrument stays fully readable in its resting state.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    fire();
    const timer = window.setInterval(fire, 4200);
    return () => window.clearInterval(timer);
  }, [fire]);

  const litPath = proof === undefined ? [] : pathFor(proof.leaf);

  return (
    <figure className="instrument">
      <div className="instrument-shell">
        <div className="instrument-core">
          <svg
            className="plate"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Sixteen membership commitments folding into a single Merkle root. A proof arrives; the public view never shows which commitment produced it."
          >
            {EDGES.map((e, i) => (
              <line key={`e${i}`} className="edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
            ))}

            {revealed &&
              litPath.map((e, i) => (
                <line
                  key={`lit${proof?.id}-${i}`}
                  className="edge-lit"
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              ))}

            {Array.from({ length: LEAVES }, (_, i) => {
              const occupied = OCCUPIED.includes(i);
              const isSource = revealed && proof?.leaf === i;
              return (
                <rect
                  key={`l${i}`}
                  className={`leaf${occupied ? ' leaf-occupied' : ''}${isSource ? ' leaf-source' : ''}`}
                  x={leafX(i) - 4.5}
                  y={LEAF_Y - 4.5}
                  width={9}
                  height={9}
                  rx={1.5}
                />
              );
            })}

            <circle
              key={`root${proof?.id}`}
              className={`root${proof === undefined ? '' : ' root-hit'}`}
              cx={W / 2}
              cy={ROOT_Y}
              r={8}
            />

            <text className="tick" x={W / 2} y={ROOT_Y - 20} textAnchor="middle">
              root
            </text>
            <text className="tick" x={MARGIN} y={H - 30}>
              16 commitments
            </text>
            <text className="tick" x={W - MARGIN} y={H - 30} textAnchor="end">
              0 identities
            </text>
          </svg>

          <div className="readout">
            <span className="readout-label">nullifier published</span>
            <output className="readout-value" key={proof?.id}>
              {proof === undefined ? '—' : `0x${proof.nullifier}…`}
            </output>
          </div>
        </div>
      </div>

      <figcaption className="instrument-foot">
        <span>{revealed ? 'You are seeing the leaf. The chain never does.' : 'The public view.'}</span>
        <button
          type="button"
          className="reveal"
          aria-pressed={revealed}
          onPointerDown={() => setRevealed(true)}
          onPointerUp={() => setRevealed(false)}
          onPointerLeave={() => setRevealed(false)}
          onKeyDown={(e) => e.key === 'Enter' && setRevealed(true)}
          onKeyUp={(e) => e.key === 'Enter' && setRevealed(false)}
        >
          hold to reveal what happened
        </button>
      </figcaption>
    </figure>
  );
};
