'use client'

import SaldosCard,       { type PFAccount }      from './SaldosCard'
import FlujoMesCard,     { type PFTransaction }   from './FlujoMesCard'
import CuotasCard,       { type PFInstallment }   from './CuotasCard'
import VencimientosCard, { type PFSubscription }  from './VencimientosCard'
import AccesoRapidoCard                           from './AccesoRapidoCard'

interface Props {
  accounts:      PFAccount[]
  transactions:  PFTransaction[]
  installments:  PFInstallment[]
  subscriptions: PFSubscription[]
  fxMep:         number | null
}

export default function PFDashboard({
  accounts, transactions, installments, subscriptions, fxMep,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Row 1: Saldos + Flujo del mes */}
      <div className="grid grid-cols-2 gap-6">
        <SaldosCard   accounts={accounts}     fxMep={fxMep} />
        <FlujoMesCard transactions={transactions} />
      </div>

      {/* Row 2: Cuotas + Vencimientos + Acceso rápido */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <CuotasCard installments={installments} />
        </div>
        <div className="col-span-1">
          <VencimientosCard subscriptions={subscriptions} />
        </div>
        <div className="col-span-1">
          <AccesoRapidoCard />
        </div>
      </div>
    </div>
  )
}
