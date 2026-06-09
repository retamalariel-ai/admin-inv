'use client'

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'

interface AllocationEntry {
  asset_type:       string
  market_value_ars: number
}

interface AllocationChartProps {
  data: AllocationEntry[]
}

function colorForType(type: string): string {
  if (['BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP'].includes(type))
    return 'oklch(0.78 0.130 168)'    /* esmeralda — RF */
  if (['ACCION_LOCAL', 'CEDEAR', 'FCI_MONEY_MARKET', 'FCI_RENTA_FIJA',
       'FCI_RENTA_VARIABLE', 'FCI_RENTA_MIXTA'].includes(type))
    return 'oklch(0.68 0.120 224)'    /* azul — RV */
  if (['CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
       'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING'].includes(type))
    return 'oklch(0.80 0.115 70)'     /* ámbar — Crypto */
  return 'oklch(0.42 0.025 255)'      /* navy muted — Cash */
}

const LABEL_MAP: Record<string, string> = {
  BONO_SOBERANO:       'Bonos Soberanos',
  BONO_SUBSOBERANO:    'Bonos Subsoberanos',
  ON:                  'Obligaciones Neg.',
  LETES:               'LETES',
  LECAP:               'LECAPs',
  ACCION_LOCAL:        'Acciones',
  CEDEAR:              'CEDEARs',
  FCI_MONEY_MARKET:    'FCI Money Market',
  FCI_RENTA_FIJA:      'FCI Renta Fija',
  FCI_RENTA_VARIABLE:  'FCI Renta Variable',
  FCI_RENTA_MIXTA:     'FCI Renta Mixta',
  CRYPTO_SPOT:         'Crypto Spot',
  CRYPTO_STABLECOIN:   'Stablecoins',
  CRYPTO_EARN:         'Crypto Earn',
  CRYPTO_DEFI_LP:      'DeFi LP',
  CRYPTO_DEFI_STAKE:   'DeFi Staking',
  CRYPTO_DEFI_LENDING: 'DeFi Lending',
  CASH_ARS:            'Cash ARS',
  CASH_USD_MEP:        'Cash USD MEP',
  CASH_USD_CCL:        'Cash USD CCL',
  CASH_CRYPTO_STABLE:  'Cash Crypto Stable',
  CASH_CRYPTO_NATIVE:  'Cash Crypto Native',
}

export default function AllocationChart({ data }: AllocationChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Sin datos de posiciones.
      </p>
    )
  }

  const chartData = data.map((d) => ({
    name:  LABEL_MAP[d.asset_type] ?? d.asset_type,
    value: d.market_value_ars,
    color: colorForType(d.asset_type),
  }))

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="44%"
          innerRadius={58}
          outerRadius={86}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) =>
            typeof value === 'number'
              ? new Intl.NumberFormat('es-AR', {
                  style:                 'currency',
                  currency:              'ARS',
                  maximumFractionDigits: 0,
                }).format(value)
              : String(value)
          }
          contentStyle={{
            backgroundColor: 'oklch(0.17 0.022 255)',
            borderColor:     'oklch(1 0 0 / 8%)',
            borderRadius:    '6px',
            color:           'oklch(0.88 0.010 255)',
            fontSize:        12,
            fontFamily:      'var(--font-mono)',
          }}
          itemStyle={{ color: 'oklch(0.78 0.130 168)' }}
        />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ paddingTop: '8px' }}
          formatter={(value) => (
            <span style={{ color: 'oklch(0.52 0.025 255)', fontSize: 11 }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
