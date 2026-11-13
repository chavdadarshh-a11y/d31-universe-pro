/**
 * D31 progression ladders. Each step has a clear, measurable criterion. Criteria are
 * conservative coaching standards (clean form only), not promises. The app checks them
 * against the user's OWN logged working sets — it never invents progress.
 */
export type Criterion = { kind: 'hold'; secs: number; sets: number } | { kind: 'reps'; reps: number; sets: number; minKg?: number }
export type LadderStep = { exId: string; goal: Criterion; tip: string }
export type Ladder = { id: string; name: string; media?: string; accent: string; summary: string; steps: LadderStep[] }

export const LADDERS: Ladder[] = [
  {
    id: 'front-lever', name: 'Front Lever', media: 'front-lever', accent: '#22d3ee',
    summary: 'Straight-arm pulling: tuck → advanced tuck → one-leg → straddle → full. Move up only when the hold is clean: arms locked, shoulders depressed, body level.',
    steps: [
      { exId: 'pull-up', goal: { kind: 'reps', reps: 8, sets: 3 }, tip: 'Strict pull-ups from a dead hang first — the base for straight-arm work.' },
      { exId: 'tuck-front-lever', goal: { kind: 'hold', secs: 10, sets: 3 }, tip: 'Back horizontal, arms straight. 3 × 10 s clean before moving on.' },
      { exId: 'adv-tuck-front-lever', goal: { kind: 'hold', secs: 10, sets: 3 }, tip: 'Flat back, hips open. Expect this step to take the longest.' },
      { exId: 'one-leg-front-lever', goal: { kind: 'hold', secs: 8, sets: 3 }, tip: 'Train both legs. Log each side as its own set with a note.' },
      { exId: 'straddle-front-lever', goal: { kind: 'hold', secs: 6, sets: 3 }, tip: 'Narrow the straddle over weeks.' },
      { exId: 'full-front-lever', goal: { kind: 'hold', secs: 5, sets: 3 }, tip: 'Legs together, one straight line.' },
    ],
  },
  {
    id: 'nordic', name: 'Nordic Curl', media: 'nordic', accent: '#f5c542',
    summary: 'Eccentric hamstring strength. Progress by control and range: assisted → slow negatives → full reps. Expect big soreness early — build volume gradually.',
    steps: [
      { exId: 'band-nordic', goal: { kind: 'reps', reps: 6, sets: 3 }, tip: 'Use the lightest band that still lets you control the full range.' },
      { exId: 'nordic-negative', goal: { kind: 'reps', reps: 5, sets: 3 }, tip: 'Aim for a 4–5 s lowering with hips straight. Note the depth you reach.' },
      { exId: 'nordic-curl', goal: { kind: 'reps', reps: 3, sets: 3 }, tip: 'Full reps: lower and pull back up with minimal hand push.' },
    ],
  },
  {
    id: 'sl-rdl', name: 'Single-Leg RDL', media: 'sl-rdl', accent: '#f472d0',
    summary: 'Unilateral mastery: own the two-leg hinge, then the kickstand, then one leg — and only then load it heavy. Hips square every rep.',
    steps: [
      { exId: 'romanian-deadlift', goal: { kind: 'reps', reps: 8, sets: 3 }, tip: 'Master the bilateral hinge first: long spine, soft knees.' },
      { exId: 'b-stance-rdl', goal: { kind: 'reps', reps: 10, sets: 3 }, tip: 'Back foot is a kickstand only.' },
      { exId: 'single-leg-rdl', goal: { kind: 'reps', reps: 10, sets: 3 }, tip: 'Bodyweight, no touch-downs, hips square. Light finger support is fine at first.' },
      { exId: 'single-leg-rdl-loaded', goal: { kind: 'reps', reps: 8, sets: 3 }, tip: 'Add load only while hip position stays square.' },
    ],
  },
  {
    id: 'pull-up', name: 'Pull-Up', media: 'pull-up', accent: '#a78bfa',
    summary: 'Assisted → eccentric → strict → weighted / archer. Scapula first, then pull.',
    steps: [
      { exId: 'dead-hang', goal: { kind: 'hold', secs: 30, sets: 3 }, tip: 'Active shoulders, steady breathing.' },
      { exId: 'scap-pull-up', goal: { kind: 'reps', reps: 10, sets: 3 }, tip: 'Arms straight — only the shoulder blades move.' },
      { exId: 'negative-pull-up', goal: { kind: 'reps', reps: 5, sets: 3 }, tip: '3–5 s lowering every rep.' },
      { exId: 'band-pull-up', goal: { kind: 'reps', reps: 8, sets: 3 }, tip: 'Reduce band thickness over time.' },
      { exId: 'pull-up', goal: { kind: 'reps', reps: 8, sets: 3 }, tip: 'Dead hang to chin over bar, no kip.' },
      { exId: 'weighted-pull-up', goal: { kind: 'reps', reps: 5, sets: 3, minKg: 10 }, tip: 'Add small jumps (1.25–2.5 kg).' },
      { exId: 'archer-pull-up', goal: { kind: 'reps', reps: 5, sets: 3 }, tip: 'Log each side; keep the assisting arm long.' },
    ],
  },
  {
    id: 'human-flag', name: 'Human Flag', media: 'shoot/067', accent: '#a3e635',
    summary: 'Vertical flag → tucked → straddle → full layout. Push the bottom hand, pull the top hand. Consistency over months beats occasional max attempts.',
    steps: [
      { exId: 'side-plank', goal: { kind: 'hold', secs: 45, sets: 3 }, tip: 'Hips high, both sides.' },
      { exId: 'vertical-flag', goal: { kind: 'hold', secs: 10, sets: 3 }, tip: 'Learn the push/pull with the body vertical.' },
      { exId: 'human-flag-progression', goal: { kind: 'hold', secs: 8, sets: 3 }, tip: 'Tucked flag, hips stacked.' },
      { exId: 'straddle-human-flag', goal: { kind: 'hold', secs: 5, sets: 3 }, tip: 'Wide legs, bottom arm locked.' },
      { exId: 'full-human-flag', goal: { kind: 'hold', secs: 5, sets: 3 }, tip: 'One straight line, parallel to the ground.' },
    ],
  },
  {
    id: 'handstand', name: 'Handstand', media: 'shoot/068', accent: '#fb923c',
    summary: 'Wall → chest-to-wall line → freestanding → pressing strength.',
    steps: [
      { exId: 'wall-handstand', goal: { kind: 'hold', secs: 30, sets: 3 }, tip: 'Comfortable inverted time first.' },
      { exId: 'chest-to-wall-handstand', goal: { kind: 'hold', secs: 45, sets: 3 }, tip: 'Straight, stacked line.' },
      { exId: 'freestanding-handstand', goal: { kind: 'hold', secs: 10, sets: 3 }, tip: 'Short, quality attempts; log your best clean hold.' },
      { exId: 'handstand-push-up', goal: { kind: 'reps', reps: 5, sets: 3 }, tip: 'Head and hands form a tripod at the bottom.' },
    ],
  },
  {
    id: 'dragon-flag', name: 'Dragon Flag', accent: '#60a5fa',
    summary: 'Tuck → negatives → full reps. Weight on the upper back, hips straight.',
    steps: [
      { exId: 'hollow-hold', goal: { kind: 'hold', secs: 30, sets: 3 }, tip: 'Lower back glued down.' },
      { exId: 'tuck-dragon-flag', goal: { kind: 'reps', reps: 8, sets: 3 }, tip: 'Hips stay open.' },
      { exId: 'dragon-flag-negative', goal: { kind: 'reps', reps: 5, sets: 3 }, tip: '3–5 s lowering as one rigid piece.' },
      { exId: 'dragon-flag', goal: { kind: 'reps', reps: 5, sets: 3 }, tip: 'Full reps, no pike.' },
    ],
  },
]

export const LADDER_BY_ID: Record<string, Ladder> = Object.fromEntries(LADDERS.map((l) => [l.id, l]))
