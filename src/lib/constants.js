// Phase definitions
export const PHASES = [
  { name: 'Foundation', start: '2026-07-04', end: '2026-07-31', color: '#10B981' },
  { name: 'Building', start: '2026-08-01', end: '2026-08-31', color: '#F59E0B' },
  { name: 'Consolidate', start: '2026-09-01', end: '2026-09-30', color: '#38BDF8' },
  { name: 'Integration', start: '2026-10-01', end: '2026-12-31', color: '#6366F1' },
]

export function getCurrentPhase() {
  const today = new Date()
  return PHASES.find(p => {
    const start = new Date(p.start)
    const end = new Date(p.end)
    return today >= start && today <= end
  }) || PHASES[PHASES.length - 1]
}

export function getDayNumber() {
  const start = new Date('2026-07-04')
  const today = new Date()
  const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff + 1)
}

// Symptom score descriptors
export const SYMPTOMS = [
  { id: 'dizziness', label: 'Dizziness', color: '#6366F1', descriptors: ['none', 'mild', 'noticeable', 'limiting', 'cannot function'] },
  { id: 'visual', label: 'Visual', color: '#38BDF8', descriptors: ['no issues', 'mild discomfort', 'frequent discomfort', 'derealization', 'limited function'] },
  { id: 'fatigue', label: 'Fatigue', color: '#EC4899', descriptors: ['energised', 'mildly tired', 'significant', 'exhausted', 'cannot get up'] },
  { id: 'gut', label: 'Gut', color: '#10B981', descriptors: ['calm', 'mild discomfort', 'cramping/nausea', 'significant activation', 'full episode'] },
  { id: 'anxiety', label: 'Anxiety', color: '#F59E0B', descriptors: ['calm', 'mild background', 'noticeable', 'panic adjacent', 'full panic'] },
]

// Episode types
export const EPISODE_TYPES = [
  { id: 'mcas', label: 'MCAS Reaction', description: 'Flushing, palpitations, nausea, rash', color: '#EC4899' },
  { id: 'prebm', label: 'Pre-BM Presyncope', description: 'Exhaustion wave, dizziness, presyncope', color: '#EF4444' },
  { id: 'cardiac', label: 'Cardiac Episode', description: 'Palpitations, SVT suspected, racing heart', color: '#EF4444' },
  { id: 'vestibular', label: 'Vestibular Crash', description: 'Derealization, elevator drops, nystagmus flare', color: '#38BDF8' },
  { id: 'gut', label: 'Gut Episode', description: 'Cramping, urgent BM, bloating, diarrhea', color: '#10B981' },
  { id: 'esophageal', label: 'Esophageal / LPR', description: 'Spasm, LPR flare, throat clearing', color: '#F59E0B' },
  { id: 'anxiety', label: 'Anxiety / Panic', description: 'Panic attack, health anxiety spiral', color: '#F59E0B' },
  { id: 'other', label: 'Other', description: '', color: '#5A5A7A' },
]

// Cycle phases
export const CYCLE_PHASES = [
  { id: 'menstrual', label: 'Menstrual', days: '1-5', risk: false },
  { id: 'follicular', label: 'Follicular', days: '6-13', risk: false },
  { id: 'ovulation', label: 'Ovulation', days: '14-16', risk: false },
  { id: 'luteal_early', label: 'Luteal early', days: '17-22', risk: false },
  { id: 'luteal_late', label: 'Luteal late', days: '23-28', risk: true },
  { id: 'pms', label: 'PMS', days: 'varies', risk: true },
]

// Confirmed trigger foods
export const DEFAULT_TRIGGERS = [
  { food: 'Gluten', trigger_category: 'intolerance', severity: 'severe' },
  { food: 'Bell peppers', trigger_category: 'mast_cell', severity: 'moderate' },
  { food: 'Lemonade / citric acid', trigger_category: 'mast_cell', severity: 'severe' },
  { food: 'Jalapeños', trigger_category: 'mast_cell', severity: 'moderate' },
  { food: 'Takis', trigger_category: 'mast_cell', severity: 'severe' },
  { food: 'Chocolate', trigger_category: 'histamine', severity: 'moderate' },
  { food: 'Bananas', trigger_category: 'oas', severity: 'moderate' },
  { food: 'Cantaloupe', trigger_category: 'oas', severity: 'moderate' },
  { food: 'Kiwi', trigger_category: 'oas', severity: 'moderate' },
  { food: 'Alcohol', trigger_category: 'histamine', severity: 'severe' },
  { food: 'Leftovers / aged food', trigger_category: 'histamine', severity: 'moderate' },
  { food: 'Artificial fragrances in food', trigger_category: 'mast_cell', severity: 'moderate' },
  { food: 'Peppermint tea', trigger_category: 'lpr', severity: 'mild' },
  { food: 'Tomato sauce', trigger_category: 'lpr', severity: 'moderate' },
]

// Daily tasks
export const TASK_GROUPS = [
  {
    id: 'medications',
    label: 'Medications',
    tasks: [
      { id: 'loratadine', text: 'Took loratadine 10mg' },
      { id: 'famo_am', text: 'Took famotidine 20mg morning' },
      { id: 'famo_pm', text: 'Took famotidine 20mg evening' },
      { id: 'b2', text: 'Took B2 riboflavin 400mg' },
      { id: 'quercetin_am', text: 'Took quercetin 500mg with breakfast' },
      { id: 'quercetin_pm', text: 'Took quercetin 500mg with dinner' },
      { id: 'b12', text: 'Took B12' },
      { id: 'd3', text: 'Took vitamin D3' },
      { id: 'dmannose', text: 'Took D-mannose' },
      { id: 'probiotic', text: 'Took probiotic' },
      { id: 'iron', text: 'Took iron and vitamin C' },
      { id: 'magnesium', text: 'Took magnesium' },
      { id: 'prozac', text: 'Took Prozac' },
      { id: 'prop1', text: 'Took propranolol dose 1 on alarm' },
      { id: 'prop2', text: 'Took propranolol dose 2 on alarm' },
      { id: 'prop3', text: 'Took propranolol dose 3 on alarm' },
    ]
  },
  {
    id: 'vestibular',
    label: 'Vestibular and PT',
    tasks: [
      { id: 'vest1', text: 'Did vestibular drills session 1' },
      { id: 'vest2', text: 'Did vestibular drills session 2' },
      { id: 'vest3', text: 'Did vestibular drills session 3' },
      { id: 'vest4', text: 'Did vestibular drills session 4' },
      { id: 'vest5', text: 'Did vestibular drills session 5' },
      { id: 'taichi', text: 'Did tai chi 10 min' },
      { id: 'barefoot', text: 'Walked barefoot on varied surfaces 10 min' },
      { id: 'singleleg', text: 'Did single leg standing' },
    ]
  },
  {
    id: 'movement',
    label: 'Movement',
    tasks: [
      { id: 'walk', text: 'Went on grounding walk 15 min' },
      { id: 'stretch', text: 'Did stretching 10 min' },
      { id: 'weights', text: 'Did weights and cervical exercises 10 min' },
    ]
  },
  {
    id: 'food',
    label: 'Food and gut',
    tasks: [
      { id: 'coffee_after', text: 'Ate before coffee' },
      { id: 'nuun', text: 'Drank NUUN' },
      { id: 'eve_tea', text: 'Had evening tea' },
    ]
  },
  {
    id: 'vagal',
    label: 'Vagal and nervous system',
    tasks: [
      { id: 'breath_am', text: 'Did morning paced breathing 5 min' },
      { id: 'gargle', text: 'Gargled 30-60 seconds' },
      { id: 'hum', text: 'Hummed or sang 5 min' },
      { id: 'breath_pm', text: 'Did evening paced breathing 5 min' },
      { id: 'cold_face', text: 'Did cold face immersion' },
      { id: 'red_light', text: 'Did red light therapy 15-20 min' },
    ]
  },
  {
    id: 'sleep',
    label: 'Sleep',
    tasks: [
      { id: 'screens_off', text: 'Turned screens off 30 min before bed' },
      { id: 'teeth_pm', text: 'Brushed teeth evening' },
      { id: 'mouth_tape', text: 'Put on mouth tape' },
      { id: 'window', text: 'Opened window' },
      { id: 'bed_time', text: 'Got into bed by 9:30pm left side head elevated' },
    ]
  },
  {
    id: 'wellness',
    label: 'Mental and emotional wellness',
    tasks: [
      { id: 'journal', text: 'Wrote in burn journal 5 min' },
      { id: 'puzzle', text: 'Did puzzle 15 min' },
      { id: 'photo', text: 'Took a photo' },
      { id: 'bed', text: 'Made bed' },
      { id: 'texted', text: 'Texted 3 people' },
      { id: 'masturbate', text: 'Masturbated' },
      { id: 'cell_song', text: 'Sang happy cell song' },
      { id: 'incense', text: 'Lit incense' },
      { id: 'shower', text: 'Showered' },
      { id: 'face_wash', text: 'Washed face' },
    ]
  },
]

export const ALL_TASKS = TASK_GROUPS.flatMap(g => g.tasks)

// Heart rate tag categories
export const HR_TAG_CATEGORIES = [
  { id: 'missed_dose', label: 'Missed dose', color: '#EF4444', icon: '💊' },
  { id: 'late_dose', label: 'Late dose', color: '#F59E0B', icon: '⏰' },
  { id: 'took_dose', label: 'Took dose', color: '#10B981', icon: '✓' },
  { id: 'episode', label: 'Episode', color: '#EC4899', icon: '⚡' },
  { id: 'exercise', label: 'Exercise', color: '#38BDF8', icon: '🏃' },
  { id: 'food_reaction', label: 'Food reaction', color: '#F59E0B', icon: '🍽' },
  { id: 'stress', label: 'Stress event', color: '#6366F1', icon: '⚠' },
  { id: 'woke_up', label: 'Woke up', color: '#9898B8', icon: '☀' },
  { id: 'notable', label: 'Notable moment', color: '#38BDF8', icon: '★' },
]

// ── DAILY SCHEDULE (tamagotchi prompts) ─────────────────────
// Times are relative to a 07:30 wake anchor. Changing wake time in settings
// shifts every prompt by the same offset via shiftSchedule().
// Success = reaching the MINIMUM. `stretch` is upside, not the bar to clear.
// Steps are capped: 5000 is the minimum, 7500 the pacing ceiling to stay under.
export const SCHEDULE_TARGETS = {
  calories: { min: 1500, stretch: 1800, unit: 'cal' },
  water:    { min: 85,   stretch: 100,  unit: 'oz' },
  steps:    { min: 5000, ceiling: 7500, unit: '' },
  sleep:    { min: 7,    stretch: 8,    unit: 'h' },
}

// kind drives the colour bar and the tap action.
// food=amber  water=sky  movement=green  meds=purple  check=indigo  rest=ink
export const SCHEDULE_KINDS = {
  meds:     { color: 'var(--purple)', label: 'Meds' },
  food:     { color: 'var(--amber)',  label: 'Food' },
  water:    { color: 'var(--sky)',    label: 'Water' },
  movement: { color: 'var(--green)',  label: 'Movement' },
  rest:     { color: 'var(--ink3)',   label: 'Rest' },
  check:    { color: 'var(--indigo)', label: 'Check-in' },
}

export const SCHEDULE = [
  { id: 'wake',          time: '07:30', kind: 'rest',     title: 'Wake + sunlight',        detail: '10 min daylight if you can',            action: 'confirm' },
  { id: 'meds_am',       time: '07:35', kind: 'meds',     title: 'Propranolol #1 + antihistamines', detail: 'Propranolol 10mg · Loratadine 10mg · Famotidine 20mg', action: 'confirm' },
  { id: 'meal_1',        time: '07:45', kind: 'food',     title: 'Mini meal #1',            detail: '~150 cal',       action: 'meal', calories: 150, water: 12 },
  { id: 'water_0830',    time: '08:30', kind: 'water',    title: 'Water',                   detail: '12 oz',          action: 'water', water: 12 },
  { id: 'meal_2',        time: '09:00', kind: 'food',     title: 'Mini meal #2',            detail: '~150 cal',       action: 'meal', calories: 150 },
  { id: 'vestibular_1',  time: '09:30', kind: 'movement', title: 'Vestibular session #1',   detail: '10 min',         action: 'timer', minutes: 10 },
  { id: 'water_1000',    time: '10:00', kind: 'water',    title: 'Water',                   detail: '16 oz',          action: 'water', water: 16 },
  { id: 'meal_3',        time: '10:30', kind: 'food',     title: 'Mini meal #3',            detail: '~150 cal',       action: 'meal', calories: 150 },
  { id: 'meds_mid',      time: '11:30', kind: 'meds',     title: 'Propranolol #2',          detail: '10mg',           action: 'confirm' },
  { id: 'meal_4',        time: '12:00', kind: 'food',     title: 'Mini meal #4',            detail: '~200 cal + 16 oz water', action: 'meal', calories: 200, water: 16 },
  { id: 'checkin_mid',   time: '12:30', kind: 'check',    title: 'Symptom check-in',        detail: 'Score your five',  action: 'checkin' },
  { id: 'rest_1300',     time: '13:00', kind: 'rest',     title: 'Rest horizontal',         detail: '20 min',         action: 'timer', minutes: 20 },
  { id: 'meal_5',        time: '14:00', kind: 'food',     title: 'Mini meal #5',            detail: '~150 cal + 12 oz water', action: 'meal', calories: 150, water: 12 },
  { id: 'walk',          time: '14:30', kind: 'movement', title: 'Grounding walk',          detail: '15-20 min',      action: 'timer', minutes: 20 },
  { id: 'meal_6',        time: '15:30', kind: 'food',     title: 'Mini meal #6',            detail: '~150 cal + 12 oz water', action: 'meal', calories: 150, water: 12 },
  { id: 'vestibular_2',  time: '16:00', kind: 'movement', title: 'Vestibular session #2',   detail: '10 min',         action: 'timer', minutes: 10 },
  { id: 'meal_7',        time: '17:00', kind: 'food',     title: 'Mini meal #7',            detail: '~150 cal',       action: 'meal', calories: 150 },
  { id: 'meds_pm',       time: '17:30', kind: 'meds',     title: 'Propranolol #3',          detail: '10mg -- do not let this one run late', action: 'confirm', critical: true },
  { id: 'meal_8',        time: '18:30', kind: 'food',     title: 'Mini meal #8 + Famotidine PM', detail: '~250 cal + 12 oz water', action: 'meal', calories: 250, water: 12 },
  { id: 'checkin_pm',    time: '19:00', kind: 'check',    title: 'Symptom check-in',        detail: 'Score your five',  action: 'checkin' },
  { id: 'meal_9',        time: '20:00', kind: 'food',     title: 'Mini meal #9',            detail: '~200 cal + 8 oz water', action: 'meal', calories: 200, water: 8 },
  { id: 'winddown',      time: '20:30', kind: 'rest',     title: 'Wind-down',               detail: 'Screens off · magnesium', action: 'confirm' },
  { id: 'bed',           time: '21:00', kind: 'rest',     title: 'In bed',                  detail: 'Aim 9-10h to clear 7-8h asleep', action: 'confirm' },
]

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const toHHMM = m => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`

// Shift every prompt by the difference between the configured wake time and 07:30.
export function shiftSchedule(wakeTime = '07:30') {
  const delta = toMin(wakeTime) - toMin('07:30')
  if (!delta) return SCHEDULE
  return SCHEDULE.map(s => ({ ...s, time: toHHMM(toMin(s.time) + delta) }))
}

// Next prompt that hasn't been actioned yet.
//
// An overdue prompt must NOT silently disappear once its time passes -- the
// original version jumped straight to the next upcoming item, which meant a
// missed Propranolol #3 vanished from view at 17:31. Late doses are exactly
// what this app exists to catch.
//
// Priority: overdue critical  ->  recently overdue  ->  next upcoming.
export const OVERDUE_WINDOW_MIN = 90

export function nextPrompt(schedule, completions = {}, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes()
  // Accepts either a completions map ({status}) or a derived-status map
  // ('done' | 'partial' | null). 'partial' still counts as pending.
  const isDone = v => v === 'done' || (v && v.status === 'done')
  const pending = schedule.filter(s => !isDone(completions[s.id]))

  const overdue = pending.filter(s => toMin(s.time) < mins)

  // A critical dose stays surfaced all day until it is confirmed or skipped.
  const criticalLate = overdue.find(s => s.critical)
  if (criticalLate) return criticalLate

  // Anything else stays surfaced for a window, then yields to what's next.
  const recentLate = overdue.filter(s => mins - toMin(s.time) <= OVERDUE_WINDOW_MIN)
  if (recentLate.length) return recentLate[recentLate.length - 1]

  return pending.find(s => toMin(s.time) >= mins) || null
}

export function minutesUntil(time, now = new Date()) {
  return toMin(time) - (now.getHours() * 60 + now.getMinutes())
}

export const scheduleTotals = (schedule, completions = {}) => {
  let calories = 0, water = 0
  schedule.forEach(s => {
    if (completions[s.id]?.status !== 'done') return
    calories += s.calories || 0
    water += s.water || 0
  })
  return { calories, water }
}

// ── SCHEDULE STATUS, DERIVED ────────────────────────────────
// The schedule is a read-only timeline. Nothing is ticked off on it directly --
// status comes from the same records the pet reads, so logging a meal in the
// food diary or a dose in Daily Practices is what marks the prompt done.
//
//   practice -> practice_logs
//   meal     -> the Nth food_entries row of the day
//   water    -> daily_logs.water_oz vs the cumulative target by that point
//   scores   -> daily_logs.scores
//   info     -> nothing to log (wake, rest)
export const PROMPT_SOURCES = {
  wake:         { type: 'info' },
  meds_am:      { type: 'practice', ids: ['prop1', 'loratadine', 'famo_am'] },
  meal_1:       { type: 'meal', index: 1 },
  water_0830:   { type: 'water' },
  meal_2:       { type: 'meal', index: 2 },
  vestibular_1: { type: 'practice', ids: ['vest1'] },
  water_1000:   { type: 'water' },
  meal_3:       { type: 'meal', index: 3 },
  meds_mid:     { type: 'practice', ids: ['prop2'] },
  meal_4:       { type: 'meal', index: 4 },
  checkin_mid:  { type: 'scores' },
  rest_1300:    { type: 'info' },
  meal_5:       { type: 'meal', index: 5 },
  walk:         { type: 'practice', ids: ['walk'] },
  meal_6:       { type: 'meal', index: 6 },
  vestibular_2: { type: 'practice', ids: ['vest2'] },
  meal_7:       { type: 'meal', index: 7 },
  meds_pm:      { type: 'practice', ids: ['prop3'] },
  meal_8:       { type: 'meal', index: 8 },
  checkin_pm:   { type: 'scores' },
  meal_9:       { type: 'meal', index: 9 },
  winddown:     { type: 'practice', ids: ['screens_off', 'magnesium'] },
  bed:          { type: 'practice', ids: ['bed_time'] },
}

// data: { practices, mealCount, waterOz, scoreCount }
// Returns { [promptId]: 'done' | 'partial' | null }.
export function deriveScheduleStatus(schedule, data = {}) {
  const { practices = {}, mealCount = 0, waterOz = 0, scoreCount = 0 } = data
  const out = {}
  let waterTarget = 0

  schedule.forEach(p => {
    const src = PROMPT_SOURCES[p.id] || { type: 'info' }
    waterTarget += p.water || 0

    if (src.type === 'info') { out[p.id] = null; return }

    if (src.type === 'practice') {
      const done = src.ids.filter(id => practices[id]).length
      out[p.id] = done === src.ids.length ? 'done' : done > 0 ? 'partial' : null
      return
    }
    if (src.type === 'meal') { out[p.id] = mealCount >= src.index ? 'done' : null; return }
    if (src.type === 'water') { out[p.id] = waterOz >= waterTarget ? 'done' : null; return }
    // Score entries aren't timestamped, so a morning and an evening check-in
    // cannot be told apart -- both read as done once any score is logged.
    if (src.type === 'scores') { out[p.id] = scoreCount > 0 ? 'done' : null; return }
    out[p.id] = null
  })
  return out
}

// Which prompts can actually be completed (used for the progress ring).
export const TRACKABLE_PROMPTS = Object.entries(PROMPT_SOURCES)
  .filter(([, v]) => v.type !== 'info')
  .map(([k]) => k)
