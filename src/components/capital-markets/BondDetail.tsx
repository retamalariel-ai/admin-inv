'use client'

import Decimal from 'decimal.js'
import { Badge } from '@/components/ui/badge'

interface BondDetailProps {
  quantityHeld:      number | null
  residualFactor:    number | null
}

function residualColor(f: number): string {
  if (f > 0.8) return 'bg-emerald-900/60 text-emerald-300'
  if (f >= 0.5) return 'bg-yellow-900/60 text-yellow-300'
  return 'bg-red-900/60 text-red-300'
}

export default function BondDetail({ quantityHeld, residualFactor }: BondDetailProps) {
  const rf  = residualFactor ?? 1
  const qty = quantityHeld   ?? 0
  const vn  = new Decimal(qty).mul(new Decimal(rf))

  return (
    <span className="flex items-center gap-2">
      <span className="text-slate-200 tabular-nums">
        {vn.toFixed(2)}
      </span>
      <Badge className={`text-xs font-mono ${residualColor(rf)}`}>
        RF {(rf * 100).toFixed(1)}%
      </Badge>
    </span>
  )
}
