/**
 * The allowlist, drawn.
 *
 * Sixteen commitments across the bottom, folding upward into a single root.
 * The point of the drawing is what it refuses to show: a proof is in flight,
 * and nothing in the picture says which leaf produced it. That is precisely
 * the view an observer of the chain gets.
 *
 * It illustrates the scheme rather than rendering live contract state, and
 * the caption says so. Every mark is painted at full strength by default; the
 * animation in the stylesheet only modulates opacity within a legible range,
 * so the drawing is complete even if no animation ever runs.
 */

const LEAVES = 16;
const W = 520;
const H = 300;

const MARGIN = 26;
const LEAF_Y = H - 58;
const ROOT_Y = 54;
const SPAN = W - MARGIN * 2;
const GAP = SPAN / (LEAVES - 1);

const leafX = (i: number): number => MARGIN + i * GAP;

/** Which leaves are drawn as occupied. Present, but not identified. */
const LIVE = new Set([1, 2, 4, 5, 7, 8, 10, 11, 13, 14]);

type Edge = { x1: number; y1: number; x2: number; y2: number };

/**
 * The fold: each level halves the node count, so the edges converge on the
 * root. Computed rather than hand-drawn, which keeps the geometry honest if
 * LEAVES ever changes.
 */
const foldEdges = (): Edge[] => {
  const edges: Edge[] = [];
  let xs = Array.from({ length: LEAVES }, (_, i) => leafX(i));
  let depth = 0;
  const totalDepth = Math.log2(LEAVES);

  while (xs.length > 1) {
    const y = LEAF_Y - ((LEAF_Y - ROOT_Y) * depth) / totalDepth;
    const yNext = LEAF_Y - ((LEAF_Y - ROOT_Y) * (depth + 1)) / totalDepth;
    const next: number[] = [];

    for (let i = 0; i < xs.length; i += 2) {
      const a = xs[i] ?? 0;
      const b = xs[i + 1] ?? a;
      const mid = (a + b) / 2;
      edges.push({ x1: a, y1: y, x2: mid, y2: yNext });
      edges.push({ x1: b, y1: y, x2: mid, y2: yNext });
      next.push(mid);
    }

    xs = next;
    depth += 1;
  }

  return edges;
};

const EDGES = foldEdges();

export const Plate = () => (
  <svg
    className="plate"
    viewBox={`0 0 ${W} ${H}`}
    role="img"
    aria-label="Sixteen membership commitments folding upward into a single Merkle root. A proof is in flight; the drawing does not reveal which commitment produced it."
  >
    {EDGES.map((e, i) => (
      <line key={`edge-${i}`} className="edge" x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
    ))}

    {Array.from({ length: LEAVES }, (_, i) => (
      <rect
        key={`leaf-${i}`}
        className={LIVE.has(i) ? 'leaf leaf-live' : 'leaf'}
        x={leafX(i) - 4}
        y={LEAF_Y - 4}
        width={8}
        height={8}
      />
    ))}

    {/* The root: the only part of this picture that is ever public. */}
    <circle className="root-mark" cx={W / 2} cy={ROOT_Y} r={7} />

    <text className="plate-label" x={W / 2} y={ROOT_Y - 18} textAnchor="middle">
      ROOT
    </text>
    <text className="plate-label" x={MARGIN} y={H - 26}>
      COMMITMENTS
    </text>
    <text className="plate-label" x={W - MARGIN} y={H - 26} textAnchor="end">
      IDENTITIES: NONE
    </text>
  </svg>
);
