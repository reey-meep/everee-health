import { useState, useEffect } from 'react'
export default function Toast({ message, color='#0A0B0F' }) {
  const [on, setOn] = useState(false)
  useEffect(()=>{ const t=setTimeout(()=>setOn(true),10); return ()=>clearTimeout(t) },[])
  return <div className={`toast${on?' on':''}`} style={{background:color}}>{message}</div>
}
