import { useState } from 'react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const PERIODS = ['Day', 'Week', 'Month', 'Year']

// Mock data generator for demo -- will be replaced with real API data
function generateMockData(metric, period) {
  const count = { Day: 24, Week: 7, Month: 30, Year: 12 }[period]
  const labels = {
    Day: Array.from({length: count}, (_, i) => `${i}:00`),
    Week: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    Month: Array.from({length: count}, (_, i) => `${i+1}`),
    Year: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  }
  const ranges = {
    steps: [2000, 12000],
    heart_rate: [55, 120],
    hrv: [20, 80],
    sleep_hours: [5, 9],
    spo2: [94, 99],
    resting_hr: [58, 75],
    active_zone_minutes: [0, 60],
    calories_burned: [1800, 3000],
    respiratory_rate: [12, 18],
    stress: [1, 5],
    dizziness: [1, 5],
    visual: [1, 5],
    fatigue: [1, 5],
    gut: [1, 5],
    anxiety: [1, 5],
  }
  const [lo, hi] = ranges[metric] || [0, 100]
  return labels[period].map((label, i) => ({
    label,
    value: Math.round(lo + Math.random() * (hi - lo)),
  }))
}

const METRIC_CONFIG = {
  steps: { label: 'Steps', unit: '', color: '#5B5EF4', goal: 7500, type: 'bar', description: 'Total steps taken today. Goal: 7,500.' },
  heart_rate: { label: 'Heart Rate', unit: 'bpm', color: '#FF3B5C', type: 'area', description: 'Real-time heart rate from your Fitbit.' },
  resting_hr: { label: 'Resting HR', unit: 'bpm', color: '#FF3B5C', type: 'line', description: 'Your lowest heart rate during a period of inactivity. Lower is generally healthier.' },
  hrv: { label: 'Heart Rate Variability', unit: 'ms', color: '#8B5CF6', type: 'area', description: 'HRV measures the variation in time between heartbeats. Higher HRV generally means better autonomic nervous system function and recovery.' },
  spo2: { label: 'Oxygen Saturation', unit: '%', color: '#00B4D8', type: 'area', description: 'Blood oxygen saturation. Normal range is 95-100%. Lower values may indicate breathing or circulation issues.' },
  respiratory_rate: { label: 'Respiratory Rate', unit: 'br/min', color: '#00B4D8', type: 'line', description: 'Average breathing rate during sleep. Normal range is 12-20 breaths per minute.' },
  active_zone_minutes: { label: 'Cardio Load', unit: 'min', color: '#F0468A', type: 'bar', goal: 150, description: 'Minutes spent in fat burn, cardio, or peak heart rate zones. Weekly goal: 150.' },
  calories_burned: { label: 'Calories Burned', unit: 'cal', color: '#FF9500', type: 'bar', description: 'Total calories burned including resting metabolism and activity.' },
  sleep_hours: { label: 'Sleep', unit: 'h', color: '#8B5CF6', type: 'bar', goal: 8, description: 'Total sleep duration. Adults need 7-9 hours. Your conditions may require more.' },
  dizziness: { label: 'Dizziness', unit: '/5', color: '#5B5EF4', type: 'bar', description: 'Daily dizziness symptom score 1-5.' },
  visual: { label: 'Visual Symptoms', unit: '/5', color: '#00B4D8', type: 'bar', description: 'Daily visual symptom score 1-5.' },
  fatigue: { label: 'Fatigue', unit: '/5', color: '#F0468A', type: 'bar', description: 'Daily fatigue symptom score 1-5.' },
  gut: { label: 'Gut Symptoms', unit: '/5', color: '#00C896', type: 'bar', description: 'Daily gut symptom score 1-5.' },
  anxiety: { label: 'Anxiety', unit: '/5', color: '#FF9500', type: 'bar', description: 'Daily anxiety symptom score 1-5.' },
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 400, color: 'var(--ink)' }}>
        {payload[0].value}{unit}
      </div>
    </div>
  )
}

export default function MetricDetail({ data, onBack }) {
  const [period, setPeriod] = useState('Week')
  const config = METRIC_CONFIG[data?.metric] || { label: data?.metric, unit: '', color: 'var(--indigo)', type: 'line' }
  const chartData = generateMockData(data?.metric, period)
  const avg = Math.round(chartData.reduce((s, d) => s + d.value, 0) / chartData.length * 10) / 10
  const max = Math.max(...chartData.map(d => d.value))
  const min = Math.min(...chartData.map(d => d.value))

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', paddingBottom: 40 }}>
      {/* HEADER */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--bd)', padding: '52px 16px 20px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: config.color, marginBottom: 14, padding: 0, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5 }}>{config.label}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 52, fontWeight: 300, color: config.color, lineHeight: 1, letterSpacing: '-.04em' }}>
            {data?.value ?? avg}{config.unit && <span style={{ fontSize: 18, color: 'var(--ink3)' }}>{config.unit}</span>}
          </div>
        </div>
        {config.description && (
          <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.55 }}>{config.description}</div>
        )}
      </div>

      {/* PERIOD SELECTOR */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 6 }}>
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 8,
              border: `1.5px solid ${period === p ? config.color : 'var(--bd)'}`,
              background: period === p ? config.color : 'var(--surface)',
              color: period === p ? 'white' : 'var(--ink2)',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all .12s',
            }}>{p}</button>
        ))}
      </div>

      {/* CHART */}
      <div style={{ background: 'var(--surface)', margin: '0 16px', borderRadius: 16, border: '1px solid var(--bd)', padding: '16px 8px 8px' }}>
        <ResponsiveContainer width="100%" height={200}>
          {config.type === 'bar' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bd)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'var(--ink3)', fontFamily: 'var(--mono)' }} tickLine={false} axisLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip unit={config.unit} />} />
              {config.goal && <ReferenceLine y={config.goal} stroke={config.color} strokeDasharray="4 2" opacity={.5} />}
              <Bar dataKey="value" fill={config.color} radius={[4, 4, 0, 0]} opacity={.85} />
            </BarChart>
          ) : config.type === 'area' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`g${data?.metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.color} stopOpacity={.25} />
                  <stop offset="100%" stopColor={config.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bd)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'var(--ink3)', fontFamily: 'var(--mono)' }} tickLine={false} axisLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip unit={config.unit} />} />
              <Area type="monotone" dataKey="value" stroke={config.color} strokeWidth={2} fill={`url(#g${data?.metric})`} dot={false} />
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--bd)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 8, fill: 'var(--ink3)', fontFamily: 'var(--mono)' }} tickLine={false} axisLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip unit={config.unit} />} />
              <Line type="monotone" dataKey="value" stroke={config.color} strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* STATS SUMMARY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '12px 16px' }}>
        {[
          { l: 'Average', v: avg + config.unit },
          { l: 'High', v: max + config.unit },
          { l: 'Low', v: min + config.unit },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 10px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 300, color: config.color, lineHeight: 1, marginBottom: 4 }}>{s.v}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ABOUT THIS METRIC */}
      <div style={{ margin: '0 16px', background: 'var(--surface)', border: '1px solid var(--bd)', borderRadius: 16, padding: '14px' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>About this metric</div>
        <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.65 }}>{config.description}</div>
        {data?.relatedToConditions && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--indigo-l)', borderRadius: 10, fontSize: 12, color: '#2A2D8B', lineHeight: 1.55 }}>
            {data.relatedToConditions}
          </div>
        )}
      </div>
    </div>
  )
}
