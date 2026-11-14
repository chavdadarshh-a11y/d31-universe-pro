/**
 * Anatomical muscle template library + warping onto a photo.
 * PURE module (no DOM, no runtime imports) so scripts/test-anatomy.ts can run it in node.
 *
 * Every muscle is a hand-authored outline in a normalised SEGMENT frame:
 *   t = position along the bone axis (0 at joint A, 1 at joint B; <0 / >1 run past the joints)
 *   s = position across the limb, -1 … +1 = the REAL body contour on each side,
 *       measured from the person-segmentation mask by ray casting.
 * In side views s>0 is the body's front; in front/back views s>0 is lateral (away from the midline).
 * Torso muscles use the shoulder-mid → hip-mid axis; front/back torso muscles are bilateral (mirrored).
 * If a segment's contour cannot be fitted confidently, the muscle is NOT drawn (never a primitive fallback).
 */
import type { P, Pose, View } from './formCheck'

export type Fine =
  | 'pec_major' | 'delt_ant' | 'delt_lat' | 'delt_post' | 'biceps' | 'brachialis' | 'triceps' | 'forearm_flexors' | 'forearm_extensors'
  | 'lats' | 'traps_upper' | 'traps_mid' | 'rhomboids' | 'teres_major' | 'serratus' | 'rectus_abdominis' | 'obliques' | 'erectors'
  | 'glute_max' | 'glute_med' | 'rectus_femoris' | 'vastus_lateralis' | 'vastus_medialis' | 'hamstrings' | 'adductors'
  | 'gastrocnemius' | 'soleus' | 'tibialis'
export type Role = 'primary' | 'secondary' | 'stabilizer'
type Seg = 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'torso'
type TS = [number, number]
type Fiber = { kind: 'along' } | { kind: 'fan'; o: TS } | { kind: 'dir'; d: TS } | { kind: 'bands'; at: number[] }
type Tpl = { id: Fine; seg: Seg; view: View | 'all'; poly: TS[]; fiber: Fiber; bilateral?: boolean }

const neg = (poly: TS[]): TS[] => poly.map(([t, s]) => [t, -s])

// ---------------- template library ----------------
const UA_SIDE: Tpl[] = [
  { id: 'triceps', seg: 'upperArm', view: 'side', poly: [[0.12, -0.2], [0.2, -0.75], [0.35, -1.0], [0.6, -0.98], [0.8, -0.8], [0.95, -0.45], [1.02, -0.2], [0.9, -0.3], [0.7, -0.36], [0.45, -0.3], [0.25, -0.16]], fiber: { kind: 'along' } },
  { id: 'brachialis', seg: 'upperArm', view: 'side', poly: [[0.5, -0.06], [0.62, 0.05], [0.78, 0.0], [0.92, 0.1], [0.99, 0.0], [0.9, -0.26], [0.72, -0.33], [0.56, -0.26]], fiber: { kind: 'along' } },
  { id: 'biceps', seg: 'upperArm', view: 'side', poly: [[0.24, 0.15], [0.3, 0.7], [0.42, 0.98], [0.6, 1.0], [0.78, 0.86], [0.9, 0.52], [0.98, 0.24], [0.93, 0.08], [0.75, 0.0], [0.5, -0.02], [0.32, 0.03]], fiber: { kind: 'along' } },
  { id: 'delt_post', seg: 'upperArm', view: 'side', poly: [[-0.16, -0.1], [-0.12, -0.6], [0.02, -0.98], [0.2, -1.02], [0.34, -0.82], [0.44, -0.4], [0.3, -0.26], [0.1, -0.16]], fiber: { kind: 'fan', o: [0.46, -0.3] } },
  { id: 'delt_lat', seg: 'upperArm', view: 'side', poly: [[-0.22, -0.32], [-0.16, 0.3], [-0.02, 0.56], [0.2, 0.5], [0.38, 0.2], [0.47, -0.04], [0.36, -0.36], [0.14, -0.55], [-0.06, -0.6]], fiber: { kind: 'fan', o: [0.5, 0.0] } },
  { id: 'delt_ant', seg: 'upperArm', view: 'side', poly: [[-0.16, 0.1], [-0.12, 0.56], [0.02, 0.96], [0.18, 1.02], [0.32, 0.86], [0.44, 0.46], [0.38, 0.25], [0.2, 0.14], [0.0, 0.02]], fiber: { kind: 'fan', o: [0.46, 0.3] } },
]
const UA_FRONT: Tpl[] = [
  { id: 'triceps', seg: 'upperArm', view: 'front', poly: [[0.16, -0.68], [0.3, -0.96], [0.5, -1.02], [0.7, -0.94], [0.86, -0.8], [1.0, -0.64], [0.88, -0.6], [0.66, -0.6], [0.42, -0.64]], fiber: { kind: 'along' } },
  { id: 'brachialis', seg: 'upperArm', view: 'front', poly: [[0.58, 0.62], [0.74, 0.9], [0.96, 0.62], [0.93, 0.36], [0.78, 0.5]], fiber: { kind: 'along' } },
  { id: 'biceps', seg: 'upperArm', view: 'front', poly: [[0.26, -0.3], [0.32, 0.45], [0.5, 0.72], [0.72, 0.62], [0.9, 0.26], [0.98, 0.0], [0.9, -0.26], [0.7, -0.56], [0.45, -0.62]], fiber: { kind: 'along' } },
  { id: 'delt_ant', seg: 'upperArm', view: 'front', poly: [[-0.16, -0.64], [-0.12, -0.2], [-0.02, 0.22], [0.12, 0.4], [0.26, 0.3], [0.4, 0.12], [0.5, 0.0], [0.38, -0.22], [0.24, -0.5], [0.06, -0.78]], fiber: { kind: 'fan', o: [0.46, -0.05] } },
  { id: 'delt_lat', seg: 'upperArm', view: 'front', poly: [[-0.22, 0.0], [-0.12, 0.72], [0.08, 1.02], [0.32, 0.92], [0.46, 0.42], [0.36, 0.12], [0.14, 0.14]], fiber: { kind: 'fan', o: [0.48, 0.3] } },
]
const UA_BACK: Tpl[] = [
  { id: 'triceps', seg: 'upperArm', view: 'back', poly: [[0.14, -0.55], [0.22, 0.1], [0.32, 0.8], [0.55, 0.96], [0.8, 0.62], [0.97, 0.16], [1.02, -0.1], [0.86, -0.46], [0.6, -0.72], [0.36, -0.82]], fiber: { kind: 'along' } },
  { id: 'delt_post', seg: 'upperArm', view: 'back', poly: [[-0.15, -0.44], [-0.1, 0.1], [0.02, 0.5], [0.16, 0.62], [0.3, 0.42], [0.5, 0.04], [0.36, -0.18], [0.2, -0.5], [0.04, -0.72]], fiber: { kind: 'fan', o: [0.46, 0.05] } },
  { id: 'delt_lat', seg: 'upperArm', view: 'back', poly: [[-0.22, 0.2], [-0.12, 0.8], [0.08, 1.02], [0.3, 0.94], [0.44, 0.52], [0.3, 0.42], [0.1, 0.4]], fiber: { kind: 'fan', o: [0.48, 0.5] } },
]
const FA_SIDE: Tpl[] = [
  { id: 'forearm_extensors', seg: 'forearm', view: 'side', poly: [[-0.04, -0.1], [0.04, -0.86], [0.2, -1.0], [0.45, -0.9], [0.68, -0.5], [0.8, -0.2], [0.6, -0.06], [0.3, 0.0]], fiber: { kind: 'along' } },
  { id: 'forearm_flexors', seg: 'forearm', view: 'side', poly: [[-0.02, 0.1], [0.05, 0.8], [0.2, 1.0], [0.42, 0.86], [0.62, 0.46], [0.76, 0.2], [0.62, 0.05], [0.3, 0.0]], fiber: { kind: 'along' } },
]
const FA_FRONT: Tpl[] = [
  { id: 'forearm_extensors', seg: 'forearm', view: 'front', poly: [[-0.04, 0.1], [0.04, 0.86], [0.2, 1.0], [0.45, 0.9], [0.68, 0.5], [0.8, 0.2], [0.6, 0.06], [0.3, 0.0]], fiber: { kind: 'along' } },
  { id: 'forearm_flexors', seg: 'forearm', view: 'front', poly: [[-0.02, -0.1], [0.05, -0.8], [0.2, -1.0], [0.42, -0.86], [0.62, -0.46], [0.76, -0.2], [0.62, -0.05], [0.3, 0.0]], fiber: { kind: 'along' } },
]
const FA_BACK: Tpl[] = [
  { id: 'forearm_extensors', seg: 'forearm', view: 'back', poly: [[-0.04, -0.6], [0.02, 0.4], [0.18, 0.95], [0.42, 0.85], [0.7, 0.4], [0.8, 0.0], [0.62, -0.3], [0.3, -0.62]], fiber: { kind: 'along' } },
]
const TH_SIDE: Tpl[] = [
  { id: 'glute_med', seg: 'thigh', view: 'side', poly: [[-0.44, 0.1], [-0.46, -0.25], [-0.42, -0.6], [-0.34, -0.72], [-0.22, -0.5], [-0.12, -0.25], [-0.08, -0.12], [-0.16, 0.0], [-0.3, 0.1]], fiber: { kind: 'fan', o: [-0.08, -0.2] } },
  { id: 'hamstrings', seg: 'thigh', view: 'side', poly: [[0.12, -0.3], [0.3, -0.5], [0.6, -0.56], [0.85, -0.46], [1.0, -0.6], [0.92, -0.96], [0.65, -1.0], [0.35, -0.98], [0.15, -0.86]], fiber: { kind: 'along' } },
  { id: 'vastus_lateralis', seg: 'thigh', view: 'side', poly: [[0.08, 0.1], [0.25, 0.2], [0.55, 0.26], [0.85, 0.36], [0.97, 0.3], [0.95, -0.06], [0.82, -0.36], [0.55, -0.46], [0.3, -0.36], [0.12, -0.16]], fiber: { kind: 'dir', d: [1, -0.25] } },
  { id: 'rectus_femoris', seg: 'thigh', view: 'side', poly: [[0.02, 0.26], [0.1, 0.7], [0.3, 0.96], [0.55, 0.93], [0.78, 0.72], [0.93, 0.46], [0.88, 0.3], [0.65, 0.26], [0.35, 0.21], [0.12, 0.16]], fiber: { kind: 'along' } },
  { id: 'glute_max', seg: 'thigh', view: 'side', poly: [[-0.32, -0.2], [-0.2, -0.86], [0.0, -1.02], [0.2, -0.96], [0.32, -0.7], [0.26, -0.4], [0.08, -0.25], [-0.1, -0.1]], fiber: { kind: 'dir', d: [0.8, 0.6] } },
]
const TH_FRONT: Tpl[] = [
  { id: 'adductors', seg: 'thigh', view: 'front', poly: [[0.02, -0.36], [0.08, -0.96], [0.3, -1.0], [0.56, -0.8], [0.5, -0.5], [0.3, -0.4]], fiber: { kind: 'dir', d: [1, 0.35] } },
  { id: 'vastus_lateralis', seg: 'thigh', view: 'front', poly: [[0.1, 0.36], [0.3, 0.86], [0.6, 1.0], [0.85, 0.86], [0.96, 0.5], [0.85, 0.36], [0.55, 0.42], [0.3, 0.36]], fiber: { kind: 'along' } },
  { id: 'vastus_medialis', seg: 'thigh', view: 'front', poly: [[0.55, -0.4], [0.7, -0.76], [0.85, -0.96], [0.97, -0.7], [0.95, -0.36], [0.85, -0.2], [0.7, -0.26]], fiber: { kind: 'dir', d: [1, 0.5] } },
  { id: 'rectus_femoris', seg: 'thigh', view: 'front', poly: [[0.03, -0.05], [0.15, 0.35], [0.4, 0.42], [0.7, 0.3], [0.88, 0.06], [0.85, -0.2], [0.6, -0.3], [0.3, -0.3], [0.1, -0.25]], fiber: { kind: 'along' } },
]
const TH_BACK: Tpl[] = [
  { id: 'adductors', seg: 'thigh', view: 'back', poly: [[0.05, -0.5], [0.15, -1.0], [0.4, -0.9], [0.46, -0.6], [0.25, -0.45]], fiber: { kind: 'along' } },
  { id: 'hamstrings', seg: 'thigh', view: 'back', poly: [[0.15, 0.05], [0.3, 0.6], [0.6, 0.86], [0.9, 0.8], [1.0, 0.4], [0.85, 0.15], [0.5, 0.05]], fiber: { kind: 'along' } },
  { id: 'hamstrings', seg: 'thigh', view: 'back', poly: [[0.15, -0.05], [0.35, -0.7], [0.65, -0.86], [0.92, -0.6], [1.0, -0.3], [0.85, -0.15], [0.5, -0.08]], fiber: { kind: 'along' } },
  { id: 'glute_med', seg: 'thigh', view: 'back', poly: [[-0.45, -0.2], [-0.42, 0.55], [-0.3, 0.86], [-0.2, 0.6], [-0.22, 0.0]], fiber: { kind: 'fan', o: [-0.12, 0.6] } },
  { id: 'glute_max', seg: 'thigh', view: 'back', poly: [[-0.3, -0.9], [-0.15, 0.2], [0.0, 0.95], [0.2, 1.0], [0.32, 0.6], [0.28, 0.0], [0.15, -0.7], [-0.1, -1.0]], fiber: { kind: 'dir', d: [0.7, 0.7] } },
]
const SH_SIDE: Tpl[] = [
  { id: 'soleus', seg: 'shin', view: 'side', poly: [[0.4, -0.3], [0.55, -0.86], [0.75, -0.86], [0.9, -0.5], [0.93, -0.25], [0.7, -0.2], [0.55, -0.16]], fiber: { kind: 'along' } },
  { id: 'gastrocnemius', seg: 'shin', view: 'side', poly: [[0.02, -0.2], [0.1, -0.86], [0.25, -1.02], [0.45, -0.86], [0.6, -0.46], [0.55, -0.2], [0.35, -0.06], [0.12, 0.05]], fiber: { kind: 'along' } },
  { id: 'tibialis', seg: 'shin', view: 'side', poly: [[0.08, 0.5], [0.2, 0.96], [0.45, 0.9], [0.7, 0.66], [0.85, 0.46], [0.7, 0.36], [0.4, 0.36], [0.15, 0.36]], fiber: { kind: 'along' } },
]
const SH_FRONT: Tpl[] = [
  { id: 'tibialis', seg: 'shin', view: 'front', poly: [[0.08, 0.05], [0.2, 0.6], [0.45, 0.66], [0.75, 0.36], [0.85, 0.1], [0.6, 0.0], [0.3, -0.05]], fiber: { kind: 'along' } },
  { id: 'gastrocnemius', seg: 'shin', view: 'front', poly: [[0.1, -0.5], [0.2, -0.96], [0.45, -0.9], [0.6, -0.6], [0.4, -0.46]], fiber: { kind: 'along' } },
]
const SH_BACK: Tpl[] = [
  { id: 'soleus', seg: 'shin', view: 'back', poly: [[0.48, 0.72], [0.75, 0.62], [0.88, 0.2], [0.86, -0.3], [0.7, -0.72], [0.52, -0.76], [0.6, -0.1]], fiber: { kind: 'along' } },
  { id: 'gastrocnemius', seg: 'shin', view: 'back', poly: [[0.02, 0.05], [0.1, 0.86], [0.3, 0.96], [0.55, 0.6], [0.6, 0.1], [0.45, 0.0], [0.2, 0.0]], fiber: { kind: 'along' } },
  { id: 'gastrocnemius', seg: 'shin', view: 'back', poly: [[0.02, -0.05], [0.1, -0.9], [0.32, -1.0], [0.62, -0.66], [0.64, -0.1], [0.45, 0.0], [0.2, 0.0]], fiber: { kind: 'along' } },
]
const TO_FRONT: Tpl[] = [
  { id: 'traps_upper', seg: 'torso', view: 'front', bilateral: true, poly: [[-0.3, 0.15], [-0.12, 0.16], [0.0, 0.45], [0.02, 0.76], [-0.08, 0.5], [-0.22, 0.28]], fiber: { kind: 'fan', o: [0.04, 0.85] } },
  { id: 'obliques', seg: 'torso', view: 'front', bilateral: true, poly: [[0.42, 0.37], [0.4, 0.7], [0.44, 0.92], [0.58, 1.0], [0.8, 0.96], [0.97, 0.8], [1.05, 0.5], [1.0, 0.3], [0.9, 0.28], [0.74, 0.35], [0.55, 0.36]], fiber: { kind: 'dir', d: [0.7, -0.7] } },
  { id: 'serratus', seg: 'torso', view: 'front', bilateral: true, poly: [[0.26, 0.92], [0.3, 0.76], [0.34, 0.88], [0.38, 0.72], [0.42, 0.86], [0.46, 0.7], [0.48, 0.88], [0.42, 0.98], [0.32, 1.0]], fiber: { kind: 'dir', d: [0.4, -1] } },
  { id: 'rectus_abdominis', seg: 'torso', view: 'front', bilateral: true, poly: [[0.39, 0.02], [0.39, 0.3], [0.55, 0.34], [0.75, 0.33], [0.92, 0.27], [1.03, 0.16], [1.03, 0.02]], fiber: { kind: 'bands', at: [0.53, 0.67, 0.81] } },
  { id: 'pec_major', seg: 'torso', view: 'front', bilateral: true, poly: [[0.0, 0.05], [-0.04, 0.4], [-0.03, 0.72], [0.04, 0.95], [0.12, 1.04], [0.2, 0.96], [0.28, 0.78], [0.35, 0.52], [0.38, 0.28], [0.37, 0.05]], fiber: { kind: 'fan', o: [0.1, 1.06] } },
]
const TO_BACK: Tpl[] = [
  { id: 'erectors', seg: 'torso', view: 'back', bilateral: true, poly: [[0.5, 0.03], [0.55, 0.18], [0.8, 0.22], [1.02, 0.2], [1.02, 0.03]], fiber: { kind: 'along' } },
  { id: 'lats', seg: 'torso', view: 'back', bilateral: true, poly: [[0.18, 0.98], [0.35, 1.02], [0.55, 0.98], [0.75, 0.88], [0.92, 0.55], [1.0, 0.2], [0.98, 0.06], [0.78, 0.06], [0.58, 0.12], [0.42, 0.3], [0.3, 0.5], [0.22, 0.72]], fiber: { kind: 'fan', o: [0.2, 1.0] } },
  { id: 'teres_major', seg: 'torso', view: 'back', bilateral: true, poly: [[0.1, 0.56], [0.13, 0.78], [0.19, 0.97], [0.28, 1.0], [0.26, 0.82], [0.18, 0.62]], fiber: { kind: 'dir', d: [-0.3, 1] } },
  { id: 'rhomboids', seg: 'torso', view: 'back', bilateral: true, poly: [[0.08, 0.05], [0.1, 0.3], [0.36, 0.38], [0.42, 0.18], [0.38, 0.05]], fiber: { kind: 'dir', d: [0.5, 1] } },
  { id: 'traps_mid', seg: 'torso', view: 'back', bilateral: true, poly: [[0.0, 0.0], [0.02, 0.3], [0.06, 0.62], [0.14, 0.58], [0.24, 0.38], [0.38, 0.18], [0.5, 0.04], [0.5, 0.0]], fiber: { kind: 'dir', d: [-0.25, 1] } },
  { id: 'traps_upper', seg: 'torso', view: 'back', bilateral: true, poly: [[-0.32, 0.0], [-0.3, 0.18], [-0.12, 0.46], [0.04, 0.86], [0.12, 0.55], [0.1, 0.2], [0.06, 0.0]], fiber: { kind: 'fan', o: [0.06, 0.9] } },
]
const TO_SIDE: Tpl[] = [
  { id: 'erectors', seg: 'torso', view: 'side', poly: [[0.45, -0.82], [0.6, -1.0], [1.02, -1.0], [1.02, -0.76], [0.75, -0.7]], fiber: { kind: 'along' } },
  { id: 'lats', seg: 'torso', view: 'side', poly: [[0.05, 0.0], [0.15, -0.5], [0.35, -0.95], [0.65, -0.96], [0.85, -0.76], [0.7, -0.4], [0.45, -0.15], [0.25, 0.05]], fiber: { kind: 'fan', o: [0.05, 0.05] } },
  { id: 'obliques', seg: 'torso', view: 'side', poly: [[0.4, 0.0], [0.42, 0.66], [0.7, 0.66], [1.0, 0.65], [1.0, 0.1], [0.75, -0.1], [0.55, -0.1]], fiber: { kind: 'dir', d: [0.7, 0.7] } },
  { id: 'serratus', seg: 'torso', view: 'side', poly: [[0.25, 0.05], [0.3, 0.45], [0.36, 0.25], [0.42, 0.5], [0.48, 0.28], [0.52, 0.0], [0.4, -0.1]], fiber: { kind: 'dir', d: [0.4, 1] } },
  { id: 'rectus_abdominis', seg: 'torso', view: 'side', poly: [[0.38, 0.7], [0.4, 1.0], [0.7, 1.02], [1.02, 0.95], [1.02, 0.7], [0.7, 0.68]], fiber: { kind: 'bands', at: [0.52, 0.68, 0.84] } },
  { id: 'pec_major', seg: 'torso', view: 'side', poly: [[0.02, 0.2], [0.0, 0.8], [0.12, 1.02], [0.3, 0.95], [0.37, 0.6], [0.3, 0.3], [0.12, 0.15]], fiber: { kind: 'fan', o: [0.04, 0.1] } },
  { id: 'traps_upper', seg: 'torso', view: 'side', poly: [[-0.34, -0.25], [-0.3, -0.62], [-0.16, -0.85], [-0.02, -0.82], [0.04, -0.5], [0.06, -0.1], [0.0, 0.05], [-0.12, -0.12], [-0.24, -0.18]], fiber: { kind: 'fan', o: [0.06, -0.2] } },
]
/** draw order = array order (deep → superficial) */
export const TEMPLATES: Tpl[] = [
  ...TO_BACK, ...TO_FRONT, ...TO_SIDE,
  ...TH_SIDE, ...TH_FRONT, ...TH_BACK, ...SH_SIDE, ...SH_FRONT, ...SH_BACK,
  ...UA_SIDE, ...UA_FRONT, ...UA_BACK, ...FA_SIDE, ...FA_FRONT, ...FA_BACK,
]
void neg

/** coarse library ids → anatomical regions drawn */
export const COARSE_TO_FINE: Record<string, Fine[]> = {
  chest: ['pec_major'], shoulders: ['delt_ant', 'delt_lat'], rear_delts: ['delt_post'], biceps: ['biceps', 'brachialis'], triceps: ['triceps'],
  forearms: ['forearm_flexors', 'forearm_extensors'], abs: ['rectus_abdominis'], obliques: ['obliques', 'serratus'], traps: ['traps_upper', 'traps_mid'],
  lats: ['lats', 'teres_major'], upper_back: ['rhomboids', 'traps_mid'], lower_back: ['erectors'], glutes: ['glute_max', 'glute_med'],
  quads: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'], hamstrings: ['hamstrings'], adductors: ['adductors'], calves: ['gastrocnemius', 'soleus'],
}
export const FINE_TO_COARSE: Record<Fine, string> = {
  pec_major: 'chest', delt_ant: 'shoulders', delt_lat: 'shoulders', delt_post: 'rear_delts', biceps: 'biceps', brachialis: 'biceps', triceps: 'triceps',
  forearm_flexors: 'forearms', forearm_extensors: 'forearms', lats: 'lats', traps_upper: 'traps', traps_mid: 'traps', rhomboids: 'upper_back', teres_major: 'lats',
  serratus: 'obliques', rectus_abdominis: 'abs', obliques: 'obliques', erectors: 'lower_back', glute_max: 'glutes', glute_med: 'glutes',
  rectus_femoris: 'quads', vastus_lateralis: 'quads', vastus_medialis: 'quads', hamstrings: 'hamstrings', adductors: 'adductors',
  gastrocnemius: 'calves', soleus: 'calves', tibialis: 'calves',
}

// ---------------- geometry ----------------
const sub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y })
const mul = (a: P, k: number): P => ({ x: a.x * k, y: a.y * k })
const len = (a: P) => Math.hypot(a.x, a.y)
const norm = (a: P): P => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l } }
const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y

/** Closed Catmull-Rom densify in template space so warped outlines stay smooth. */
export function densify(poly: TS[], per = 6): TS[] {
  const n = poly.length, out: TS[] = []
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n], p3 = poly[(i + 2) % n]
    for (let k = 0; k < per; k++) {
      const u = k / per, u2 = u * u, u3 = u2 * u
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  return out
}

export type Mask = { w: number; h: number; data: ArrayLike<number>; sx: number; sy: number }
const maskAt = (m: Mask, p: P) => {
  const x = Math.round(p.x * m.sx), y = Math.round(p.y * m.sy)
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return 0
  return m.data[y * m.w + x]
}

type Frame = { map: (t: number, s: number) => P; A: P; B: P }
/** prior: typical half-width as a fraction of torso length along t (from anthropometric proportions) */
type SegDef = { a: number; b: number; lo: number; hi: number; prior: (t: number) => number; minLen: number }
const ramp = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))
const PRI = {
  upperArm: (t: number) => 0.12 + 0.07 * (1 - ramp(t, -0.05, 0.3)) - 0.03 * ramp(t, 0.7, 1.05),
  forearm: (t: number) => 0.105 - 0.04 * ramp(t, 0.2, 0.85),
  thigh: (t: number) => 0.2 + 0.12 * (1 - ramp(t, -0.2, 0.25)) - 0.07 * ramp(t, 0.5, 1.05),
  shin: (t: number) => 0.13 - 0.06 * ramp(t, 0.35, 0.95),
}
const SEGS: Record<Exclude<Seg, 'torso'>, { L: SegDef; R: SegDef }> = {
  upperArm: { L: { a: 11, b: 13, lo: -0.3, hi: 1.05, prior: PRI.upperArm, minLen: 0.34 }, R: { a: 12, b: 14, lo: -0.3, hi: 1.05, prior: PRI.upperArm, minLen: 0.34 } },
  forearm: { L: { a: 13, b: 15, lo: -0.1, hi: 0.85, prior: PRI.forearm, minLen: 0.3 }, R: { a: 14, b: 16, lo: -0.1, hi: 0.85, prior: PRI.forearm, minLen: 0.3 } },
  thigh: { L: { a: 23, b: 25, lo: -0.46, hi: 1.05, prior: PRI.thigh, minLen: 0.45 }, R: { a: 24, b: 26, lo: -0.46, hi: 1.05, prior: PRI.thigh, minLen: 0.45 } },
  shin: { L: { a: 25, b: 27, lo: 0, hi: 0.95, prior: PRI.shin, minLen: 0.45 }, R: { a: 26, b: 28, lo: 0, hi: 0.95, prior: PRI.shin, minLen: 0.45 } },
}

type Meas = { A: P; B: P; n: P; lo: number; hi: number; prior: (t: number) => number; wp: number[]; wn: number[]; inside: number; edge: number }
const NS = 24

/**
 * Ray-cast the body contour on both sides of the bone axis. A sample counts only if the ray leaves the mask
 * within an anatomical band around the prior width (so a barbell plate, a bench pad or a touching limb is
 * never taken as muscle). Widths are stored as ratio to the prior.
 */
function measure(A: P, B: P, n: P, mask: Mask, lo: number, hi: number, prior: (t: number) => number, capPos?: (t: number) => number, capNeg?: (t: number) => number): Meas {
  const wp: number[] = [], wn: number[] = []
  let inside = 0, core = 0, coreHit = 0
  const step = Math.max(0.75, 1 / Math.max(mask.sx, mask.sy))
  const cast = (c: P, dir: P, max: number): number => {
    for (let d = 0; d <= max; d += step) if (maskAt(mask, add(c, mul(dir, d))) < 0.5) return d
    return NaN
  }
  for (let i = 0; i <= NS; i++) {
    const t = lo + ((hi - lo) * i) / NS
    const c = lerp(A, B, t), pr = prior(t)
    const isCore = t >= 0.1 && t <= 0.9
    const inn = maskAt(mask, c) >= 0.5
    if (isCore) { core++; if (inn) inside++ }
    const band = (v: number) => (Number.isFinite(v) && v >= 0.45 * pr ? v : NaN)
    const dp = inn ? band(cast(c, n, Math.min(1.75 * pr, capPos ? capPos(t) : Infinity))) : NaN
    const dn = inn ? band(cast(c, mul(n, -1), Math.min(1.75 * pr, capNeg ? capNeg(t) : Infinity))) : NaN
    if (isCore && (Number.isFinite(dp) || Number.isFinite(dn))) coreHit++
    wp.push(dp / pr); wn.push(dn / pr)
  }
  const m = { A, B, n, lo, hi, prior, wp, wn, inside: inside / core, edge: coreHit / core }
  fitDebug.push({ A, B, inside: m.inside, fracP: m.edge, fracN: 0, wp: wp.map((v) => +v.toFixed(2)), wn: wn.map((v) => +v.toFixed(2)), pr: Math.round(prior(0.5)) } as never)
  return m
}

const median = (a: number[]) => { const f = a.filter(Number.isFinite).sort((x, y) => x - y); return f.length ? f[f.length >> 1] : NaN }

/**
 * Turn a measurement into a frame — or null (= draw nothing) when the bone axis is not on the person.
 * Unmeasured samples: other side → interpolated along the bone → this segment's ratio → the person's ratio.
 */
function toFrame(m: Meas, personRatio: number): Frame | null {
  if (m.inside < 0.7) return null
  // a side whose contour is hidden (limb touching limb, bench pad, plate…) is NOT mirrored from the other
  // side (bone axes are rarely centred) — it uses the person's own measured build instead
  const fillSide = (a: number[]) => {
    const got = a.filter(Number.isFinite).length / a.length
    const v = got >= 0.35 ? a.slice() : a.map(() => personRatio)
    for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) {
      let l = i - 1; while (l >= 0 && !Number.isFinite(v[l])) l--
      let r = i + 1; while (r < v.length && !Number.isFinite(v[r])) r++
      const L = l >= 0 ? v[l] : NaN, R = r < v.length ? v[r] : NaN
      v[i] = Number.isFinite(L) && Number.isFinite(R) ? L + ((R - L) * (i - l)) / (r - l) : Number.isFinite(L) ? L : Number.isFinite(R) ? R : personRatio
    }
    // temper single-sample spikes, then smooth
    const f = v.map((_, i) => median(v.slice(Math.max(0, i - 2), i + 3)))
    return f.map((_, i) => { const w = f.slice(Math.max(0, i - 1), i + 2); return w.reduce((x, y) => x + y, 0) / w.length })
  }
  const P1 = fillSide(m.wp), N1 = fillSide(m.wn)
  const { A, B, n, lo, hi, prior } = m
  const at = (arr: number[], t: number) => {
    const f = ((Math.max(lo, Math.min(hi, t)) - lo) / (hi - lo)) * NS
    const i = Math.max(0, Math.min(NS - 1, Math.floor(f))), k = Math.max(0, Math.min(1, f - i))
    return (arr[i] * (1 - k) + arr[i + 1] * k) * prior(t)
  }
  return { A, B, map: (t, s) => add(lerp(A, B, t), mul(n, s >= 0 ? s * at(P1, t) : s * at(N1, t))) }
}

/** diagnostics of the last fits (tests only) */
export const fitDebug: { A: P; B: P; inside: number; fracP: number; fracN: number }[] = []

export type DrawnMuscle = { id: Fine; role: Role; seg: Seg; polys: P[][]; fibers: P[][]; anchor: P }
export type NotDrawn = { id: Fine; role: Role; reason: 'view' | 'fit' }

function fiberLines(tpl: Tpl, poly: TS[]): TS[][] {
  const ts = poly.map((p) => p[0]), ss = poly.map((p) => p[1])
  const t0 = Math.min(...ts), t1 = Math.max(...ts), s0 = Math.min(...ss), s1 = Math.max(...ss)
  const out: TS[][] = []
  const f = tpl.fiber
  const K = 9
  if (f.kind === 'along') for (let k = 0; k <= K; k++) { const s = s0 + ((s1 - s0) * k) / K; out.push(Array.from({ length: 13 }, (_, i) => [t0 + ((t1 - t0) * i) / 12, s + Math.sin(i / 2) * 0.01] as TS)) }
  else if (f.kind === 'fan') for (const p of densify(poly, 2)) out.push(Array.from({ length: 8 }, (_, i) => [f.o[0] + (p[0] - f.o[0]) * (i / 7) * 1.05, f.o[1] + (p[1] - f.o[1]) * (i / 7) * 1.05] as TS))
  else if (f.kind === 'dir') {
    const d = f.d, nrm = [-d[1], d[0]], c = [(t0 + t1) / 2, (s0 + s1) / 2], R = Math.max(t1 - t0, s1 - s0)
    for (let k = -K; k <= K; k++) { const o = (k / K) * R; out.push(Array.from({ length: 9 }, (_, i) => { const u = ((i / 8) * 2 - 1) * R; return [c[0] + nrm[0] * o + d[0] * u, c[1] + nrm[1] * o + d[1] * u] as TS })) }
  } else {
    for (const t of f.at) out.push(Array.from({ length: 9 }, (_, i) => [t, s0 + ((s1 - s0) * i) / 8] as TS))
    for (let k = 1; k <= 3; k++) { const s = s0 + ((s1 - s0) * k) / 4; out.push(Array.from({ length: 9 }, (_, i) => [t0 + ((t1 - t0) * i) / 8, s] as TS)) }
  }
  return out
}

/**
 * Fit every wanted muscle onto the photo. Only segments whose joints are clearly visible, that are not badly
 * foreshortened, and whose contour is fitted from the segmentation mask are drawn.
 */
export type FitResult = { drawn: DrawnMuscle[]; notDrawn: NotDrawn[]; occluders: P[][] }
export function fitMuscles(pose: Pose, mask: Mask | null, roles: Partial<Record<Fine, Role>>): FitResult {
  const wanted = Object.keys(roles) as Fine[]
  fitDebug.length = 0
  const drawn = new Map<Fine, DrawnMuscle>()
  const fitFail = new Set<Fine>()
  if (!pose.ok || !mask) return { drawn: [], notDrawn: wanted.map((id) => ({ id, role: roles[id]!, reason: 'fit' })), occluders: [] }
  const P = pose.pts, T = pose.torsoLen, view = pose.view
  const shM = pose.named.shM, hipM = pose.named.hipM
  // side view: only the limb nearer to the camera (smaller z / higher score); front/back: both
  const sidesFor = (seg: Exclude<Seg, 'torso'>) => {
    const d = SEGS[seg]
    if (view !== 'side') return [d.L, d.R]
    const zs = (s: SegDef) => (pose.z?.[s.a] ?? 0) + (pose.z?.[s.b] ?? 0)
    const both = [d.L, d.R].filter((s) => P[s.a] && P[s.b])
    if (both.length < 2) return both
    return [zs(both[0]) <= zs(both[1]) ? both[0] : both[1]]
  }
  // pass 1: measure every candidate segment against the mask
  const meas = new Map<string, Meas | null>()
  const limbKey = (seg: Exclude<Seg, 'torso'>, d: SegDef) => `${seg}-${d.a}`
  for (const seg of Object.keys(SEGS) as Exclude<Seg, 'torso'>[]) for (const d of sidesFor(seg)) {
    const A = P[d.a], B = P[d.b]
    let m: Meas | null = null
    if (A && B && len(sub(B, A)) >= d.minLen * T) {
      const ax = norm(sub(B, A))
      let n = { x: -ax.y, y: ax.x }
      let ok = true
      if (view === 'side') { if (!pose.front) ok = false; else if (dot(n, pose.front) < 0) n = mul(n, -1) }
      else if (shM && hipM) {
        const axis = norm(sub(hipM, shM)), mm = lerp(A, B, 0.5), rel = sub(mm, shM)
        const lat = sub(rel, mul(axis, dot(rel, axis)))
        if (len(lat) < 1) ok = false
        else if (dot(n, lat) < 0) n = mul(n, -1)
      } else ok = false
      if (ok) m = measure(A, B, n, mask, d.lo, d.hi, (t) => d.prior(t) * T)
    }
    meas.set(limbKey(seg, d), m)
  }
  let torsoM: Meas | null = null
  if (shM && hipM) {
    const ax = norm(sub(hipM, shM))
    let n = { x: -ax.y, y: ax.x }
    // three-quarter views (shoulder spread between side and front) are ambiguous for trunk muscles: not drawn
    if (view === 'side' && (pose.spread ?? 0) > 0.3) { /* trunk not clearly front, back or side */ }
    else if (view === 'side') {
      if (pose.front) {
        if (dot(n, pose.front) < 0) n = mul(n, -1)
        torsoM = measure(shM, hipM, n, mask, -0.35, 1.08, (t) => (0.3 + 0.04 * ramp(t, 0.6, 1.0)) * T)
      }
    } else if (P[11] && P[12] && P[23] && P[24]) {
      if (dot(n, sub(P[11], P[12])) < 0) n = mul(n, -1)
      const pr = (t: number) => { const k = Math.max(0, Math.min(1, t)); const sh = len(sub(P[11], P[12])) / 2, hp = len(sub(P[23], P[24])) / 2; return Math.max(0.25 * T, (sh * (1 - k) + hp * 1.35 * k) * 1.05) }
      torsoM = measure(shM, hipM, n, mask, -0.35, 1.08, pr)
    }
  }
  // the person's own build: median limb width ratio over everything that was measured
  const personRatio = (() => { const r = median([...meas.values()].filter((m): m is Meas => !!m && m.inside >= 0.7).flatMap((m) => [...m.wp, ...m.wn])); return Number.isFinite(r) ? Math.max(0.7, Math.min(1.5, r)) : 1 })()
  const frames = new Map<string, Frame | null>()
  for (const [k, m] of meas) frames.set(k, m ? toFrame(m, personRatio) : null)
  const torso = torsoM ? toFrame(torsoM, 1) : null
  const limbFrame = (seg: Exclude<Seg, 'torso'>, d: SegDef) => frames.get(limbKey(seg, d)) ?? null
  const torsoFrame = () => torso

  for (const tpl of TEMPLATES) {
    const role = roles[tpl.id]
    if (!role) continue
    if (tpl.view !== 'all' && tpl.view !== view) continue
    const frs: { f: Frame; mirror: boolean }[] = []
    if (tpl.seg === 'torso') {
      const f = torsoFrame()
      if (!f) { fitFail.add(tpl.id); continue }
      frs.push({ f, mirror: false })
      if (tpl.bilateral) frs.push({ f, mirror: true })
    } else {
      for (const d of sidesFor(tpl.seg)) { const f = limbFrame(tpl.seg, d); if (f) frs.push({ f, mirror: false }); else fitFail.add(tpl.id) }
    }
    const dense = densify(tpl.poly)
    const fibers = fiberLines(tpl, tpl.poly)
    for (const { f, mirror } of frs) {
      const map = (p: TS) => f.map(p[0], mirror ? -p[1] : p[1])
      const poly = dense.map(map)
      const m = drawn.get(tpl.id) ?? { id: tpl.id, role, seg: tpl.seg, polys: [], fibers: [], anchor: { x: 0, y: 0 } }
      m.polys.push(poly)
      m.fibers.push(...fibers.map((l) => l.map(map)))
      drawn.set(tpl.id, m)
    }
  }
  for (const m of drawn.values()) {
    const pts = m.polys.flat()
    // anchor = centroid of the first (most visible) shape
    const first = m.polys[0]
    m.anchor = mul(first.reduce((a, b) => add(a, b), { x: 0, y: 0 }), 1 / first.length)
    void pts
  }
  const notDrawn: NotDrawn[] = wanted.filter((id) => !drawn.has(id)).map((id) => ({ id, role: roles[id]!, reason: fitFail.has(id) ? 'fit' : 'view' }))
  // arms in front of the trunk hide trunk muscles (side + front views): their silhouettes are cut out of torso shapes
  const occluders: P[][] = []
  if (view !== 'back') for (const seg of ['upperArm', 'forearm'] as const) for (const d of sidesFor(seg)) {
    const f = limbFrame(seg, d)
    if (!f) continue
    const t0 = seg === 'upperArm' ? 0.12 : 0, t1 = seg === 'upperArm' ? 1.02 : 0.9
    const band: P[] = []
    for (let i = 0; i <= 12; i++) band.push(f.map(t0 + ((t1 - t0) * i) / 12, 1))
    for (let i = 12; i >= 0; i--) band.push(f.map(t0 + ((t1 - t0) * i) / 12, -1))
    occluders.push(band)
  }
  return { drawn: [...drawn.values()], notDrawn, occluders }
}

/**
 * "Is this an ellipse/primitive?" — IoU between a polygon and the ellipse with the same second moments.
 * Hand-authored anatomical outlines are asymmetric/tapered (IoU well below 1); an ellipse scores ≈ 1.
 */
export function ellipseLikeness(poly: P[]): number {
  const n = poly.length
  let A = 0, cx = 0, cy = 0
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n], c = p.x * q.y - q.x * p.y; A += c; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c }
  A /= 2; cx /= 6 * A; cy /= 6 * A
  let sxx = 0, syy = 0, sxy = 0
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const G = 60
  const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c } return c }
  const cells: [number, number, boolean][] = []
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / G, y = y0 + ((y1 - y0) * (j + 0.5)) / G
    const inn = inside(x, y)
    cells.push([x, y, inn])
    if (inn) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy) }
  }
  const cnt = cells.filter((c) => c[2]).length || 1
  sxx /= cnt; syy /= cnt; sxy /= cnt
  // ellipse with the same covariance: (d^T Σ^-1 d) <= 4
  const det = sxx * syy - sxy * sxy || 1e-9
  const ix = syy / det, iy = sxx / det, ixy = -sxy / det
  let inter = 0, uni = 0
  const pad = 0.4
  const X0 = x0 - (x1 - x0) * pad, X1 = x1 + (x1 - x0) * pad, Y0 = y0 - (y1 - y0) * pad, Y1 = y1 + (y1 - y0) * pad
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const x = X0 + ((X1 - X0) * (i + 0.5)) / G, y = Y0 + ((Y1 - Y0) * (j + 0.5)) / G
    const dx = x - cx, dy = y - cy
    const e = dx * dx * ix + dy * dy * iy + 2 * dx * dy * ixy <= 4
    const p = inside(x, y)
    if (e && p) inter++
    if (e || p) uni++
  }
  return uni ? inter / uni : 0
}

/**
 * Primitive-shape score in 0..1: the larger of (a) IoU with the moment-matched ellipse and (b) the shape's
 * symmetry about BOTH principal axes (ellipses, lenses, capsules, rectangles are symmetric both ways —
 * real muscle outlines taper towards their tendons and are not). Muscle shapes must stay below ~0.94.
 */
export function primitiveScore(poly: P[]): number {
  const n = poly.length
  let A = 0, cx = 0, cy = 0
  for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n], c = p.x * q.y - q.x * p.y; A += c; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c }
  A /= 2; cx /= 6 * A; cy /= 6 * A
  let sxx = 0, syy = 0, sxy = 0
  for (const p of poly) { sxx += (p.x - cx) ** 2; syy += (p.y - cy) ** 2; sxy += (p.x - cx) * (p.y - cy) }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  const u = { x: Math.cos(th), y: Math.sin(th) }, v = { x: -u.y, y: u.x }
  const loc = poly.map((p) => ({ a: (p.x - cx) * u.x + (p.y - cy) * u.y, b: (p.x - cx) * v.x + (p.y - cy) * v.y }))
  const inside = (pl: { a: number; b: number }[], x: number, y: number) => { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a.b > y) !== (b.b > y) && x < ((b.a - a.a) * (y - a.b)) / (b.b - a.b) + a.a) c = !c } return c }
  const R = Math.max(...loc.map((p) => Math.max(Math.abs(p.a), Math.abs(p.b)))) * 1.05
  const G = 70
  let i1 = 0, u1 = 0, i2 = 0, u2 = 0
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const x = -R + (2 * R * (i + 0.5)) / G, y = -R + (2 * R * (j + 0.5)) / G
    const o = inside(loc, x, y), fa = inside(loc, -x, y), fb = inside(loc, x, -y)
    if (o && fa) i1++
    if (o || fa) u1++
    if (o && fb) i2++
    if (o || fb) u2++
  }
  const sym = Math.min(u1 ? i1 / u1 : 0, u2 ? i2 / u2 : 0)
  return Math.max(ellipseLikeness(poly), sym)
}
