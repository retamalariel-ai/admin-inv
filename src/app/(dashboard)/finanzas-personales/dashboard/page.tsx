import { createClient } from '@/lib/supabase/server'
import PFDashboard from '@/components/personal-finance/PFDashboard'
import type { PFAccount }      from '@/components/personal-finance/SaldosCard'
import type { PFTransaction }  from '@/components/personal-finance/FlujoMesCard'
import type { PFInstallment }  from '@/components/personal-finance/CuotasCard'
import type { PFSubscription } from '@/components/personal-finance/VencimientosCard'

export default async function PFDashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const now            = new Date()
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const in30Days       = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)

  const [
    { data: accounts },
    { data: transactions },
    { data: installments },
    { data: subscriptions },
    { data: fxRow },
  ] = await Promise.all([
    supabase
      .from('personal_accounts')
      .select('id, name, type, currency, current_balance, owner')
      .eq('is_active', true),

    supabase
      .from('personal_transactions')
      .select('id, type, amount, currency, amount_ars, description, date')
      .gte('date', monthStart)
      .order('date', { ascending: false }),

    supabase
      .from('personal_installments')
      .select('id, description, installment_amount, currency, total_installments, paid_installments, start_date, card_id, personal_cards(name)')
      .eq('is_active', true),

    supabase
      .from('personal_subscriptions')
      .select('id, name, amount, currency, frequency, next_due_date, personal_categories(name, icon)')
      .eq('is_active', true)
      .lte('next_due_date', in30Days)
      .order('next_due_date', { ascending: true }),

    supabase
      .from('fx_rates')
      .select('rate_mep')
      .order('rate_date', { ascending: false })
      .order('rate_time', { ascending: false })
      .limit(1)
      .single(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Finanzas Personales
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Resumen de cuentas, flujo y compromisos del mes
        </p>
      </div>

      <PFDashboard
        accounts={      (accounts      ?? []) as PFAccount[]      }
        transactions={  (transactions  ?? []) as PFTransaction[]  }
        installments={  (installments  ?? []) as PFInstallment[]  }
        subscriptions={ (subscriptions ?? []) as PFSubscription[] }
        fxMep={         fxRow?.rate_mep ?? null                   }
      />
    </div>
  )
}
