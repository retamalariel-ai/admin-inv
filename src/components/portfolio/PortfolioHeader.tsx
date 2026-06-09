'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlusCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import TransactionDialog from '@/components/transactions/TransactionDialog'
import type { Database } from '@/types/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']

const CUSTODIAN_BADGE: Record<string, string> = {
  ALYCE:         'bg-blue-900/60 text-blue-300',
  EXCHANGE_CEX:  'bg-amber-900/60 text-amber-300',
  WALLET_HW:     'bg-purple-900/60 text-purple-300',
  WALLET_SW:     'bg-slate-700 text-slate-300',
  DEFI_PROTOCOL: 'bg-emerald-900/60 text-emerald-300',
  EARN_PLATFORM: 'bg-orange-900/60 text-orange-300',
  OTRO:          'bg-slate-700 text-slate-400',
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
        <div className="text-sm text-slate-400 mb-2">
          <a href={`/clientes/${clientId}`} className="hover:text-slate-200 transition-colors">
            ← Volver al cliente
          </a>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{portfolio.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
              <Badge className={`text-xs border-0 ${CUSTODIAN_BADGE[portfolio.custodian_type] ?? 'bg-slate-700 text-slate-400'}`}>
                {CUSTODIAN_LABEL[portfolio.custodian_type] ?? portfolio.custodian_type}
              </Badge>
              <span>{portfolio.custodian_name}</span>
              {portfolio.account_identifier && (
                <span className="font-mono">{portfolio.account_identifier}</span>
              )}
              <span className="text-slate-600">·</span>
              <span>{portfolio.base_currency}</span>
            </div>
            {portfolio.description && (
              <p className="mt-2 text-sm text-slate-500">{portfolio.description}</p>
            )}
          </div>
          <Button
            onClick={() => setTxOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Nueva Transacción
          </Button>
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
