'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle, FileDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import TransactionDialog from '@/components/transactions/TransactionDialog'
import type { Database } from '@/types/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

const CUSTODIAN_BADGE: Record<string, string> = {
  ALYCE:         'bg-blue-100 text-blue-700',
  EXCHANGE_CEX:  'bg-amber-100 text-amber-700',
  WALLET_HW:     'bg-purple-100 text-purple-700',
  WALLET_SW:     'bg-slate-100 text-slate-600',
  DEFI_PROTOCOL: 'bg-emerald-100 text-emerald-700',
  EARN_PLATFORM: 'bg-orange-100 text-orange-700',
  OTRO:          'bg-slate-100 text-slate-500',
}
const CUSTODIAN_LABEL: Record<string, string> = {
  ALYCE: 'ALyC', EXCHANGE_CEX: 'CEX', WALLET_HW: 'HW Wallet',
  WALLET_SW: 'SW Wallet', DEFI_PROTOCOL: 'DeFi', EARN_PLATFORM: 'Earn', OTRO: 'Otro',
}

interface PortfolioHeaderProps {
  portfolio:   Portfolio
  clientId:    string
  portfolioId: string
}

export default function PortfolioHeader({ portfolio, clientId, portfolioId }: PortfolioHeaderProps) {
  const router = useRouter()
  const [txOpen, setTxOpen] = useState(false)

  return (
    <>
      <div>
        <div className="text-sm text-muted-foreground mb-2">
          <a href={`/clientes/${clientId}`} className="hover:text-foreground transition-colors">
            ← Volver al cliente
          </a>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{portfolio.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge className={`text-xs border-0 ${CUSTODIAN_BADGE[portfolio.custodian_type] ?? 'bg-slate-100 text-slate-500'}`}>
                {CUSTODIAN_LABEL[portfolio.custodian_type] ?? portfolio.custodian_type}
              </Badge>
              <span>{portfolio.custodian_name}</span>
              {portfolio.account_identifier && (
                <span className="font-mono">{portfolio.account_identifier}</span>
              )}
              <span className="text-muted-foreground/40">·</span>
              <span>{portfolio.base_currency}</span>
            </div>
            {portfolio.description && (
              <p className="mt-2 text-sm text-muted-foreground">{portfolio.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/reports/portfolio/${portfolioId}`}
              target="_blank"
              download
            >
              <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground hover:bg-accent/10">
                <FileDown className="h-4 w-4 mr-2" />
                Reporte PDF
              </Button>
            </a>
            <Button
              onClick={() => setTxOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Nueva Transacción
            </Button>
          </div>
        </div>
      </div>

      <TransactionDialog
        portfolioId={portfolioId}
        open={txOpen}
        onOpenChange={setTxOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
