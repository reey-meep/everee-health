import { useState, useEffect } from 'react'

export default function Toast({ message, color = '#10B981' }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setShow(true))
    return () => setShow(false)
  }, [])
  return (
    <div className={`toast ${show ? 'show' : ''}`} style={{ background: color }}>
      {message}
    </div>
  )
}
