// Time-adaptive scoring for the Holland Lop pet.
//
// The pet reflects progress RELATIVE TO THIS POINT IN THE DAY, not end-of-day
// totals -- so at 10am, 450 cal is "on track", not "behind".

// [hour, calories, waterOz, steps, requiredItemsDone]
const TARGET_CURVE = [
  [7.5,     0,   0,    0,  0],
  [8,     150,  12,    0,  3],
  [9,     300,  24,  500,  3],
  [10,    450,  40, 1000,  4],
  [11,    600,  52, 2000,  5],
  [12,    750,  60, 2500,  6],
  [13,    900,  68, 3000,  6],
  [14,   1050,  76, 3500,  7],
  [15,   1100,  82, 4000,  7],
  [16,   1150,  88, 4500,  8],
  [17,   1200,  92, 5000,  9],
  [18,   1350,  96, 5500, 10],
  [19,   1500, 100, 6000, 11],
  [20,   1600, 100, 6500, 12],
  [21,   1800, 100, 7000, 13],
  [22,   1800, 100, 7500, 13],
]

// The curve assumes 13 required practices. All 13 now exist in TASK_GROUPS
// (magnesium, face_wash and teeth_pm were added), so the scale factor is 1.
// It is kept rather than removed so that if the required list and the curve
// ever diverge again, the target rescales instead of silently capping the
// score -- which would pin the pet to a sad mood with no visible cause.
const CURVE_REQUIRED_TOTAL = 13

// Real IDs from constants.js TASK_GROUPS. The spec's ids (prop_1, vest_1,
// famotidine_am) do not match what practice_logs actually stores; renaming the
// tasks would orphan existing logged rows, so map here instead.
export const REQUIRED_PRACTICE_IDS = [
  'famo_am',   // spec: famotidine_am
  'prozac',
  'prop1',     // spec: prop_1
  'prop2',     // spec: prop_2
  'prop3',     // spec: prop_3
  'nuun',
  'vest1',     // spec: vest_1
  'vest2',     // spec: vest_2
  'vest3',     // spec: vest_3
  'shower',
  'face_wash',
  'teeth_pm',
  'magnesium',
]
export const MISSING_REQUIRED_IDS = []

const REQ_SCALE = REQUIRED_PRACTICE_IDS.length / CURVE_REQUIRED_TOTAL

const lerp = (a, b, t) => a + (b - a) * t

export function interpolateTargets(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60
  if (h <= TARGET_CURVE[0][0]) {
    return { cal: 0, water: 0, steps: 0, reqDone: 0 }
  }
  const last = TARGET_CURVE[TARGET_CURVE.length - 1]
  if (h >= last[0]) {
    return { cal: last[1], water: last[2], steps: last[3], reqDone: last[4] * REQ_SCALE }
  }
  for (let i = 0; i < TARGET_CURVE.length - 1; i++) {
    const [h0, c0, w0, s0, r0] = TARGET_CURVE[i]
    const [h1, c1, w1, s1, r1] = TARGET_CURVE[i + 1]
    if (h >= h0 && h < h1) {
      const t = (h - h0) / (h1 - h0)
      return {
        cal: lerp(c0, c1, t),
        water: lerp(w0, w1, t),
        steps: lerp(s0, s1, t),
        reqDone: lerp(r0, r1, t) * REQ_SCALE,
      }
    }
  }
  return { cal: 0, water: 0, steps: 0, reqDone: 0 }
}

// actual: { cal, water, steps, reqDone, bonusDone }
export function getAdaptiveScore(actual, now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60
  // After 10pm judge against daily minimums rather than the curve.
  const target = h >= 22
    ? { cal: 1500, water: 85, steps: 5000, reqDone: REQUIRED_PRACTICE_IDS.length }
    : interpolateTargets(now)

  const ratio = (a, t) => Math.min((a || 0) / Math.max(t, 1), 1.5)
  const calScore = ratio(actual.cal, target.cal)
  const waterScore = ratio(actual.water, target.water)
  const stepsScore = ratio(actual.steps, target.steps)
  const reqScore = ratio(actual.reqDone, target.reqDone)

  const raw = (calScore + waterScore + stepsScore + reqScore) / 4
  const bonus = Math.min((actual.bonusDone || 0) * 0.02, 0.3)
  return {
    score: Math.min(raw + bonus, 1.5),
    parts: { calScore, waterScore, stepsScore, reqScore },
    target,
  }
}

// Four states, driven by the time-adaptive score (progress vs. where you
// should be at this hour -- not end-of-day totals).
export const PET_STATES = [
  { id: 'critical',    label: 'Critical',    message: 'She needs you right now',      hint: 'Well behind for this time of day' },
  { id: 'poor',        label: 'Poor',        message: 'Falling behind — one small step', hint: 'Under where you should be by now' },
  { id: 'healthy',     label: 'Healthy',     message: 'On track — good job',          hint: 'Roughly where you should be' },
  { id: 'flourishing', label: 'Flourishing', message: 'Thriving — she is so happy',   hint: 'Ahead of the curve for this hour' },
]

export function stateFromScore(score) {
  if (score < 0.5) return 0   // critical
  if (score < 0.8) return 1   // poor
  if (score < 1.1) return 2   // healthy
  return 3                    // flourishing
}

// Body / mind / joy groupings. The spec named these bars but did not define
// which practices feed them; this is an interpretation, not a spec quote.
//   body = intake and movement (calories, water, steps)
//   mind = clinical protocol adherence (meds, vestibular, vagal)
//   joy  = the wellness group -- the things that are for her, not her illness
export const MIND_GROUPS = ['medications', 'vestibular', 'vagal']
export const JOY_GROUPS = ['wellness']

export function getBars(actual, taskGroups, practices, now = new Date()) {
  const { parts } = getAdaptiveScore(actual, now)
  const body = (parts.calScore + parts.waterScore + parts.stepsScore) / 3

  const ratioFor = groupIds => {
    const tasks = taskGroups.filter(g => groupIds.includes(g.id)).flatMap(g => g.tasks)
    if (!tasks.length) return 0
    const done = tasks.filter(t => practices[t.id]).length
    return done / tasks.length
  }
  return {
    body: Math.min(body, 1),
    mind: ratioFor(MIND_GROUPS),
    joy: ratioFor(JOY_GROUPS),
  }
}
