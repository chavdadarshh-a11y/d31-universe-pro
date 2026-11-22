// Synthetic MediaPipe-style poses for the motion-game tests (node + Playwright test hook).
// synthPose(kind, depth 0..1, opts) → 33 normalized landmarks (y down). Self-contained: Playwright injects it via toString().
export function synthPose(kind, d, o = {}) {
  const aspect = o.aspect ?? 0.75 // frame width / height
  const vis = o.vis ?? 0.95
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.08, presence: 0.08 }))
  // X in "height units" (0..aspect) → normalized x
  const set = (i, X, y, v = vis) => { lm[i] = { x: X / aspect, y, visibility: v, presence: v } }
  const C = aspect / 2
  const rad = (g) => (g * Math.PI) / 180
  if (kind === 'pushup') {
    // front camera on the floor: wrists fixed, shoulders drop, elbows bend outward to angle th
    const th = (o.top ?? 170) - ((o.top ?? 170) - (o.bottom ?? 78)) * d
    const ys = 0.42 + 0.17 * d
    const wr = [[C - 0.17, 0.8], [C + 0.17, 0.8]], sh = [[C - 0.11, ys], [C + 0.11, ys]]
    set(0, C, ys - 0.1)
    ;[[11, 13, 15, 0, -1], [12, 14, 16, 1, 1]].forEach(([s, e, w, k, out]) => {
      const [sx, sy] = sh[k], [wx, wy] = wr[k]
      const dx = wx - sx, dy = wy - sy, dist = Math.hypot(dx, dy)
      const L = dist / (2 * Math.sin(rad(th) / 2))
      const h = Math.sqrt(Math.max(0, L * L - (dist / 2) ** 2))
      let nx = -dy / dist, ny = dx / dist
      if (nx * out < 0) { nx = -nx; ny = -ny }
      set(s, sx, sy); set(w, wx, wy); set(e, (sx + wx) / 2 + nx * h, (sy + wy) / 2 + ny * h)
    })
    // hips / legs out of view behind the body
    return lm
  }
  if (kind === 'squatSide' || kind === 'squatFront') {
    const knee = (o.top ?? 172) - ((o.top ?? 172) - (o.bottom ?? 82)) * d // knee angle
    const thigh = 0.2, shinL = 0.19, torso = 0.26
    if (kind === 'squatSide') {
      const ank = [C, 0.9]
      const phiS = rad(8 + 25 * d) // shin leans forward
      const kn = [ank[0] + shinL * Math.sin(phiS), ank[1] - shinL * Math.cos(phiS)]
      // knee→ankle direction, rotate by knee angle (backwards) to get knee→hip
      const a0 = Math.atan2(ank[1] - kn[1], ank[0] - kn[0])
      const a1 = a0 + rad(knee)
      const hp = [kn[0] + thigh * Math.cos(a1), kn[1] + thigh * Math.sin(a1)]
      const lean = rad(o.lean ?? (10 + 32 * d))
      const sh = [hp[0] + torso * Math.sin(lean), hp[1] - torso * Math.cos(lean)]
      const far = o.farVis ?? 0.3
      ;[[11, sh], [23, hp], [25, kn], [27, ank]].forEach(([i, p]) => set(i, p[0], p[1]))
      ;[[12, sh], [24, hp], [26, kn], [28, ank]].forEach(([i, p]) => set(i, p[0] + 0.01, p[1], far))
      set(13, sh[0] + 0.08, sh[1] + 0.06); set(15, sh[0] + 0.16, sh[1] + 0.04)
      set(14, sh[0] + 0.08, sh[1] + 0.06, far); set(16, sh[0] + 0.16, sh[1] + 0.04, far)
      set(0, sh[0] + 0.02, sh[1] - 0.08)
      return lm
    }
    // facing the camera: hips drop to knee level, knee angle in 2-D stays nearly straight
    const ankY = 0.9, kneeY = ankY - shinL * 0.97
    const hipY = kneeY - thigh * (1 - d * 1.05) // d≈0.95+ → hip at/below knee
    const ankW = 0.1, kneeW = (o.cave ? 0.06 : 0.105), hipW = 0.075
    const shY = hipY - torso
    set(27, C - ankW, ankY); set(28, C + ankW, ankY)
    set(25, C - kneeW, kneeY); set(26, C + kneeW, kneeY)
    set(23, C - hipW, hipY); set(24, C + hipW, hipY)
    set(11, C - 0.1, shY); set(12, C + 0.1, shY)
    set(13, C - 0.12, shY + 0.1); set(14, C + 0.12, shY + 0.1)
    set(15, C - 0.1, shY + 0.02); set(16, C + 0.1, shY + 0.02)
    set(0, C, shY - 0.08)
    return lm
  }
  return lm // 'none': nothing confidently visible
}
