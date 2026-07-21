// Time-adaptive scoring for the Holland Lop pet.
//
// The pet reflects progress RELATIVE TO THIS POINT IN THE DAY, not end-of-day
// totals -- so at 10am, 450 cal is "on track", not "behind".

// [hour, calories, waterOz, steps, requiredItemsDone]
//
// The curve ramps to the DAILY MINIMUMS -- 1500 cal, 85 oz, 5000 steps -- not
// the stretch goals. Hitting the minimum is success; anything beyond is upside.
// It previously ramped to 1800/100/7500, so a day that met every minimum still
// scored ~0.8 and left her at "poor".
const TARGET_CURVE = [
  [7.5,     0,   0,    0,  0],
  [8,     125,  10,    0,  3],
  [9,     250,  20,  350,  3],
  [10,    375,  34,  650,  4],
  [11,    500,  44, 1350,  5],
  [12,    625,  51, 1650,  6],
  [13,    750,  58, 2000,  6],
  [14,    875,  65, 2350,  7],
  [15,    900,  70, 2650,  7],
  [16,    950,  75, 3000,  8],
  [17,   1000,  78, 3350,  9],
  [18,   1125,  82, 3650, 10],
  [19,   1250,  85, 4000, 11],
  [20,   1350,  85, 4350, 12],
  [21,   1500,  85, 4650, 13],
  [22,   1500,  85, 5000, 13],
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
    ? { cal: 1500, water: 85, steps: 5000, reqDone: REQUIRED_PRACTICE_IDS.length }  // daily minimums
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

// Two bars, and every practice group belongs to exactly one of them.
// Previously movement, food and sleep were in NO bar, so ~40% of the practice
// list was invisible to the display.
//
//   body = the physical work: intake, movement, and the clinical routine
//          (food, water, steps, vestibular drills, medications)
//   mind = everything else
export const BODY_GROUPS = ['medications', 'vestibular']
export const MIND_GROUPS = ['movement', 'food', 'vagal', 'sleep', 'wellness']

function groupRatio(groupIds, taskGroups, practices) {
  const tasks = taskGroups.filter(g => groupIds.includes(g.id)).flatMap(g => g.tasks)
  if (!tasks.length) return 0
  return tasks.filter(t => practices[t.id]).length / tasks.length
}

export function getBars(actual, taskGroups, practices, now = new Date()) {
  const { parts } = getAdaptiveScore(actual, now)
  // Body blends the three intake/movement measures with the clinical practices,
  // so food, water and steps carry the same weight as the routine itself.
  const intake = (parts.calScore + parts.waterScore + parts.stepsScore) / 3
  const bodyPractices = groupRatio(BODY_GROUPS, taskGroups, practices)
  return {
    body: Math.min((intake + bodyPractices) / 2, 1),
    mind: groupRatio(MIND_GROUPS, taskGroups, practices),
  }
}
