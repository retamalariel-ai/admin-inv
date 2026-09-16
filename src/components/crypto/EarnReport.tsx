'use client'

import { useMemo } from 'react'
import Decimal from 'decimal.js'
import { formatUSD } from '@/lib/utils/calculations'

export interface EarnTransaction {
  trade_date: string
  net_amount: number
  platform:   string  // ticker string; mapped to display name internally
  ticker:     string
}

const TICKER_TO_PLATFORM: Record<string, string> = {
  'USDT-EARN':   'Nexo Earn CeFi',
  'NEXO':        'Nexo Earn CeFi',
  'USDC-MORPHO': 'Morpho Protocol',
  'USDC-KAMINO': 'Kamino Finance',
  'USDC-VESSEO': 'Vesper / Smoothie',
  'SOL-STAKE':   'Kiln (SOL Staking)',
}

function tickerToPlatform(ticker: string): string {
  return TICKER_TO_PLATFORM[ticker.toUpperCase()] ?? ticker
}

// MM/YYYY → YYYY-MM (for chronological sort)
function monthSortKey(mmyyyy: string): string {
  const [m, y] = mmyyyy.split('/')
  return `${y}-${m}`
}

interface Props {
  earnTransactions: EarnTransaction[]
}

export default function EarnReport({ earnTransactions }: Props) {
  const { platforms, months, matrix, monthTotals, platformTotals, grandTotal } = useMemo(() => {
    const platformMap = new Map<string, Record<string, number>>()
    const monthSet    = new Set<string>()

    for (const tx of earnTransactions) {
      const platform = tickerToPlatform(tx.ticker)
      const [y, m]   = tx.trade_date.slice(0, 7).split('-')
      const month    = `${m}/${y}` // MM/YYYY

      monthSet.add(month)
      if (!platformMap.has(platform)) platformMap.set(platform, {})
      const row   = platformMap.get(platform)!
      row[month]  = (row[month] ?? 0) + (tx.net_amount ?? 0)
    }

    const months    = [...monthSet].sort((a, b) =>
      monthSortKey(a) < monthSortKey(b) ? -1 : 1,
    )
    const platforms = [...platformMap.keys()].sort()

    const matrix: Record<string, Record<string, number>> = Object.fromEntries(platformMap)

    const monthTotals: Record<string, number> = {}
    for (const month of months) {
      monthTotals[month] = platforms.reduce((s, p) => s + (matrix[p]?.[month] ?? 0), 0)
    }

    const platformTotals: Record<string, number> = {}
    for (const platform of platforms) {
      platformTotals[platform] = months.reduce((s, m) => s + (matrix[platform]?.[m] ?? 0), 0)
    }

    const grandTotal = months.reduce((s, m) => s + (monthTotals[m] ?? 0), 0)

    return { platforms, months, matrix, monthTotals, platformTotals, grandTotal }
  }, [earnTransactions])

  if (earnTransactions.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-slate-800/60 border-b border-slate-700">
        <p className="text-sm font-semibold text-slate-100">
          Earn / Income — Histórico por período
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Todos los portfolios · en USD</p>
      </div>

      {/* Pivot table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/40">
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium
                             min-w-[180px] sticky left-0 bg-slate-800/40 z-10">
                Plataforma
              </th>
              {months.map(m => (
                <th key={m} className="text-right px-3 py-2.5 text-slate-400
                                       font-medium min-w-[90px] whitespace-nowrap">
                  {m}
                </th>
              ))}
              <th className="text-right px-4 py-2.5 text-slate-300 font-semibold min-w-[100px]">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {platforms.map(platform => (
              <tr key={platform}
                  className="border-b border-slate-700/50 hover:bg-slate-800/30">
                <td className="px-4 py-2 text-slate-300 sticky left-0 bg-slate-900/60 z-10">
                  {platform}
                </td>
                {months.map(m => {
                  const val = matrix[platform]?.[m]
                  return (
                    <td key={m} className="text-right px-3 py-2 text-slate-300">
                      {val != null && val > 0
                        ? formatUSD(new Decimal(val))
                        : <span className="text-slate-600">—</span>}
                    </td>
                  )
                })}
                <td className="text-right px-4 py-2 text-slate-100 font-medium">
                  {formatUSD(new Decimal(platformTotals[platform] ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="bg-slate-700/50 border-t border-slate-600">
              <td className="px-4 py-2.5 text-slate-200 font-semibold
                             sticky left-0 bg-slate-700/50 z-10">
                TOTAL
              </td>
              {months.map(m => (
                <td key={m} className="text-right px-3 py-2.5 text-emerald-300 font-medium">
                  {formatUSD(new Decimal(monthTotals[m] ?? 0))}
                </td>
              ))}
              <td className="text-right px-4 py-2.5 text-emerald-300 font-semibold">
                {formatUSD(new Decimal(grandTotal))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
