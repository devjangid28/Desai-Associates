import { useEffect, useState } from 'react'

export default function DebugOverlay() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const push = (kind) => (event) => {
      const detail =
        event && event.error
          ? event.error && event.error.stack
            ? event.error.stack
            : String(event.error)
          : typeof event === 'object' && event.message
            ? event.message + (event.filename ? ` @ ${event.filename}:${event.lineno}` : '')
            : String(event)
      setLogs((prev) => [...prev.slice(-6), { kind, detail }])
    }

    const onError = push('error')
    const onRejection = push('unhandledrejection')

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!logs.length) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 999999,
        maxWidth: 'min(560px, 92vw)',
        maxHeight: 220,
        overflow: 'auto',
        background: 'rgba(20,20,25,0.95)',
        color: '#ffb4b4',
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: 11,
        lineHeight: 1.45,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #ff6b6b',
        pointerEvents: 'none',
      }}
    >
      {logs.map((l, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 700 }}>[{l.kind}]</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{l.detail}</pre>
        </div>
      ))}
    </div>
  )
}
