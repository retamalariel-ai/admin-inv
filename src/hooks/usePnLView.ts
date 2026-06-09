'use client'

import { useState, useCallback } from 'react'

export type PnLView = 'ARS' | 'HOY' | 'USD' | 'DETALLE'

const STORAGE_KEY = 'pnl-view'

export function usePnLView(): [PnLView, (v: PnLView) => void] {
  const [view, setView] = useState<PnLView>(() => {
    if (typeof window === 'undefined') return 'ARS'
    return (localStorage.getItem(STORAGE_KEY) as PnLView) ?? 'ARS'
  })
  const set = useCallback((v: PnLView) => {
    setView(v)
    try { localStorage.setItem(STORAGE_KEY, v) } catch { /* ignore */ }
  }, [])
  return [view, set]
}
