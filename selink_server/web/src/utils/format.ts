// Vietnamese number/time formatting (spec 7.1: decimal comma, Asia/Ho_Chi_Minh).
export const TZ = 'Asia/Ho_Chi_Minh'

export function num(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–'
  return v.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function dt(iso?: string | null, withSeconds = false): string {
  if (!iso) return '–'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
  }).format(new Date(iso))
}

export function ago(iso?: string | null): string {
  if (!iso) return '–'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return `${Math.round(s)} giây trước`
  if (s < 3600) return `${Math.round(s / 60)} phút trước`
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`
  return `${Math.round(s / 86400)} ngày trước`
}

// ECharts renders in browser-local time; shift so the axis shows Vietnam time everywhere.
const vnOffsetMin = 7 * 60
export function vnMs(iso: string | number): number {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  return t + (vnOffsetMin + new Date(t).getTimezoneOffset()) * 60000
}

export const STATUS: Record<string, { label: string; color: string; tag: string }> = {
  normal: { label: 'Bình thường', color: '#2fa84f', tag: 'success' },
  watch: { label: 'Theo dõi', color: '#d9a406', tag: 'gold' },
  warning: { label: 'Cảnh báo', color: '#e8710a', tag: 'orange' },
  danger: { label: 'Nguy hiểm', color: '#d62f3a', tag: 'red' },
  offline: { label: 'Mất kết nối', color: '#7b8794', tag: 'default' },
  info: { label: 'Thông tin', color: '#2f6fa8', tag: 'blue' },
}

export const EVENT_STATE: Record<string, string> = {
  raised: 'Mới', acknowledged: 'Đã xem', diagnosed: 'Đã chẩn đoán', resolved: 'Đã xử lý', closed: 'Đóng',
}

export const ZONE_COLOR: Record<string, string> = { A: '#2fa84f', B: '#d9a406', C: '#e8710a', D: '#d62f3a' }
export const ZONE_BG = { A: 'rgba(47,168,79,0.10)', B: 'rgba(217,164,6,0.12)', C: 'rgba(232,113,10,0.12)', D: 'rgba(214,47,58,0.12)' }

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : `"${String(c).replace(/"/g, '""')}"`)).join(',')).join('\n')
}

export function saveCSV(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export const ROLE_RANK: Record<string, number> = { viewer: 1, operator: 2, engineer: 3, analyst: 4, admin: 5 }

/** Mounting positions in display order. */
export const POSITIONS = ['DE', 'NDE', 'BASE', 'LOAD']
const LEGACY_POSITION: Record<string, string> = { S1: 'LOAD', S2: 'BASE', S3: 'DE', S4: 'NDE', COMP: 'LOAD' }

/** Sensor name used everywhere on screen: its mounting position (DE, NDE, BASE, LOAD). */
export function sensorCode(point: { location?: string | null; role?: string | null; id?: string } | null | undefined): string {
  const raw = String(point?.location || '').trim().toUpperCase()
  const loc = LEGACY_POSITION[raw] || raw
  if (POSITIONS.includes(loc)) return loc
  if (point?.role === 'base') return 'BASE'
  return loc ? loc.slice(0, 8) : String(point?.id || '--').split('-').pop()!.toUpperCase()
}
