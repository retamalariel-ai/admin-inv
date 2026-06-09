'use client'

import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { formatARS, formatUSD } from '@/lib/utils/calculations'

interface ClientRow {
  client_id:                string
  client_name:              string
  total_aum_ars:            number
  total_aum_usd:            number
  total_unrealized_pnl_ars: number
  total_unrealized_pnl_usd: number
  portfolio_count:          number
}

interface ClientsTableProps {
  clients: ClientRow[]
}

function PnlARS({ value }: { value: number }) {
  const d    = new Decimal(value)
  const isPos = d.gte(0)
  return (
    <span className={`font-financial tabular-nums font-medium ${
      isPos
        ? 'text-primary'
        : 'text-destructive'
    }`}>
      {isPos ? '+' : ''}{formatARS(d)}
    </span>
  )
}

function PnlUSD({ value }: { value: number }) {
  const d    = new Decimal(value)
  const isPos = d.gte(0)
  return (
    <span className={`font-financial tabular-nums font-medium ${
      isPos
        ? 'text-primary'
        : 'text-destructive'
    }`}>
      {isPos ? '+' : ''}{formatUSD(d)}
    </span>
  )
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`
    px-5 py-3
    text-[10px] font-semibold uppercase tracking-[0.10em]
    text-muted-foreground/70
    ${right ? 'text-right' : 'text-left'}
  `}>
    {children}
  </th>
)

export default function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter()

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No hay clientes con posiciones activas.
      </p>
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-border/60">
          <TH>Cliente</TH>
          <TH right>AUM ARS</TH>
          <TH right>AUM USD</TH>
          <TH right>P&L No Real. ARS</TH>
          <TH right>P&L No Real. USD</TH>
          <TH right>Port.</TH>
        </tr>
      </thead>
      <tbody>
        {clients.map((c) => (
          <tr
            key={c.client_id}
            onClick={() => router.push(`/clientes/${c.client_id}`)}
            className="
              border-b border-border/30 last:border-0
              hover:bg-accent/40 cursor-pointer
              transition-colors duration-100
            "
          >
            <td className="px-5 py-4 text-sm font-medium text-foreground/90">
              {c.client_name}
            </td>
            <td className="px-5 py-4 text-right">
              <span className="font-financial text-sm tabular-nums text-foreground/75">
                {formatARS(new Decimal(c.total_aum_ars))}
              </span>
            </td>
            <td className="px-5 py-4 text-right">
              <span className="font-financial text-sm tabular-nums text-foreground/75">
                {formatUSD(new Decimal(c.total_aum_usd))}
              </span>
            </td>
            <td className="px-5 py-4 text-right text-sm">
              <PnlARS value={c.total_unrealized_pnl_ars} />
            </td>
            <td className="px-5 py-4 text-right text-sm">
              <PnlUSD value={c.total_unrealized_pnl_usd} />
            </td>
            <td className="px-5 py-4 text-right">
              <span className="font-financial text-sm text-muted-foreground">
                {c.portfolio_count}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
