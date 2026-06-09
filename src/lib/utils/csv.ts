type CSVValue = string | number | null | undefined

function escapeCSV(v: CSVValue): string {
  const s = v == null ? '' : String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCSV(rows: Record<string, CSVValue>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCSV(row[h])).join(',')),
  ].join('\n')
}

export function downloadCSV(filename: string, rows: Record<string, CSVValue>[]): void {
  const csv = toCSV(rows)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
