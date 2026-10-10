import { useEffect, useRef } from 'react'
import { getToken } from './client'

export type RtMessage = { channel: string; data: any }
type Handler = (m: RtMessage) => void

// One shared WebSocket with reference-counted subscriptions and auto-reconnect (spec 6.6 /ws).
class Realtime {
  private ws: WebSocket | null = null
  private subs = new Map<string, number>()
  private handlers = new Set<Handler>()
  private retry = 1000

  connect() {
    const token = getToken()
    if (!token || this.ws) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 1000
      if (this.subs.size) ws.send(JSON.stringify({ sub: [...this.subs.keys()] }))
    }
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data)
        if (m.channel) this.handlers.forEach((h) => h(m))
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      this.ws = null
      setTimeout(() => this.connect(), this.retry)
      this.retry = Math.min(this.retry * 2, 30000)
    }
  }

  subscribe(keys: string[], h: Handler) {
    this.handlers.add(h)
    const fresh = keys.filter((k) => {
      const n = this.subs.get(k) || 0
      this.subs.set(k, n + 1)
      return n === 0
    })
    this.connect()
    if (fresh.length && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ sub: fresh }))
    return () => {
      this.handlers.delete(h)
      const gone = keys.filter((k) => {
        const n = (this.subs.get(k) || 1) - 1
        if (n <= 0) this.subs.delete(k)
        else this.subs.set(k, n)
        return n <= 0
      })
      if (gone.length && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ unsub: gone }))
    }
  }
}

export const realtime = new Realtime()

export function useRealtime(keys: string[], handler: Handler) {
  const ref = useRef(handler)
  ref.current = handler
  const key = keys.join('|')
  useEffect(() => {
    if (!keys.length) return
    return realtime.subscribe(keys, (m) => {
      if (keys.includes(m.channel)) ref.current(m)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
