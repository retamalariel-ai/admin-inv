import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  title:    { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 11, color: '#64748b' },
  section:  { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: '6 8',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    color: 'white',
    padding: '5 4',
    fontSize: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '4 4',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    fontSize: 8,
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableRowTotal: {
    flexDirection: 'row',
    padding: '4 4',
    fontSize: 8,
    backgroundColor: '#e2e8f0',
    fontWeight: 'bold',
  },

  // Columnas posiciones abiertas
  c_tick:   { width: '8%' },
  c_name:   { width: '22%' },
  c_cant:   { width: '8%',  textAlign: 'right' },
  c_ppp:    { width: '10%', textAlign: 'right' },
  c_price:  { width: '10%', textAlign: 'right' },
  c_ars:    { width: '12%', textAlign: 'right' },
  c_usd:    { width: '10%', textAlign: 'right' },
  c_pnl:    { width: '10%', textAlign: 'right' },
  c_pct:    { width: '10%', textAlign: 'right' },

  // Columnas operaciones cerradas
  cc_tick:  { width: '8%' },
  cc_name:  { width: '24%' },
  cc_date:  { width: '11%' },
  cc_cost:  { width: '13%', textAlign: 'right' },
  cc_pnl:   { width: '14%', textAlign: 'right' },
  cc_pct:   { width: '10%', textAlign: 'right' },
  cc_pusd:  { width: '20%', textAlign: 'right' },

  positive: { color: '#16a34a' },
  negative: { color: '#dc2626' },

  summaryRow:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  summaryLabel:    { fontSize: 8, color: '#64748b', marginBottom: 4 },
  summaryValue:    { fontSize: 13, fontWeight: 'bold' },
  summarySubValue: { fontSize: 8, color: '#64748b', marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: '#94a3b8' },

  disclaimer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fefce8',
    borderWidth: 0.5,
    borderColor: '#fde68a',
    borderRadius: 3,
    fontSize: 7,
    color: '#713f12',
    lineHeight: 1.4,
  },
  noteBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#eff6ff',
    borderLeftWidth: 2,
    borderLeftColor: '#2563eb',
    fontSize: 7,
    color: '#1e40af',
    lineHeight: 1.4,
  },
})

// Tipos de cambio
export interface FxRates {
  mep:     number
  ccl:     number
  oficial: number
  blue:    number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export interface ReportProps {
  client: { full_name: string; email?: string | null }
  portfolio: { name: string; custodian_name: string }
  positions:       Row[]
  closedPositions: Row[]
  fxRates:         FxRates
  generatedAt:     Date
  managerName?:    string
}

const TYPE_LABELS: Record<string, string> = {
  BONO_SOBERANO:       'Bonos Soberanos',
  BONO_SUBSOBERANO:    'Bonos Sub-soberanos',
  ON:                  'Obligaciones Negociables',
  LETES:               'Letras del Tesoro',
  LECAP:               'Letras de Capitalización',
  ACCION_LOCAL:        'Acciones',
  CEDEAR:              'CEDEARs',
  FCI_MONEY_MARKET:    'FCIs Money Market',
  FCI_RENTA_FIJA:      'FCIs Renta Fija',
  FCI_RENTA_VARIABLE:  'FCIs Renta Variable',
  FCI_RENTA_MIXTA:     'FCIs Mixtos',
  CRYPTO_SPOT:         'Criptomonedas',
  CRYPTO_STABLECOIN:   'Stablecoins',
  CRYPTO_EARN:         'Crypto Earn',
  CASH_ARS:            'Cash ARS',
  CASH_USD_MEP:        'Cash USD',
}

const TYPE_ORDER: Record<string, number> = {
  BONO_SOBERANO: 1, BONO_SUBSOBERANO: 2, ON: 3, LETES: 4, LECAP: 5,
  ACCION_LOCAL: 6, CEDEAR: 7,
  FCI_MONEY_MARKET: 8, FCI_RENTA_FIJA: 9, FCI_RENTA_VARIABLE: 10, FCI_RENTA_MIXTA: 11,
  CRYPTO_SPOT: 12, CRYPTO_STABLECOIN: 13, CRYPTO_EARN: 14,
  CASH_ARS: 15, CASH_USD_MEP: 16,
}

function assetInfo(assets: Row | Row[] | null): { ticker: string; name: string } {
  const a = Array.isArray(assets) ? assets[0] : assets
  return { ticker: a?.ticker ?? '—', name: a?.name ?? '—' }
}

function fmt(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

function pnlColor(n: number) {
  return n >= 0 ? styles.positive : styles.negative
}

export function PortfolioReport({
  client, portfolio, positions, closedPositions,
  fxRates, generatedAt, managerName,
}: ReportProps) {
  const totalARS      = positions.reduce((s, p) => s + (p.market_value_ars     ?? 0), 0)
  const totalUSD      = positions.reduce((s, p) => s + (p.market_value_usd     ?? 0), 0)
  const pnlNoRealARS  = positions.reduce((s, p) => s + (p.unrealized_pnl_ars   ?? 0), 0)
  const dailyPnlARS   = positions.reduce((s, p) => s + (p.daily_pnl_ars        ?? 0), 0)
  const pnlRealARS    = [...positions, ...closedPositions]
    .reduce((s, p) => s + (p.realized_gain_loss_ars ?? 0), 0)

  const dateStr = generatedAt.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const timeStr = generatedAt.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })

  const sorted = [...positions].sort((a, b) => {
    const oa = TYPE_ORDER[a.asset_type] ?? 99
    const ob = TYPE_ORDER[b.asset_type] ?? 99
    if (oa !== ob) return oa - ob
    return (b.market_value_ars ?? 0) - (a.market_value_ars ?? 0)
  })

  const grouped = sorted.reduce<Record<string, Row[]>>((acc, p) => {
    const t = p.asset_type as string
    ;(acc[t] ??= []).push(p)
    return acc
  }, {})

  const hasBondUSD = positions.some(
    p => ['BONO_SOBERANO', 'BONO_SUBSOBERANO'].includes(p.asset_type) &&
         ['USD_CCL', 'USD_MEP'].includes(p.asset_currency),
  )

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Informe de Cartera</Text>
            <Text style={styles.subtitle}>{client.full_name}</Text>
            <Text style={styles.subtitle}>
              {portfolio.name} — {portfolio.custodian_name}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: '#64748b' }}>Fecha: {dateStr}</Text>
            <Text style={{ fontSize: 9, color: '#64748b' }}>Hora: {timeStr} (ART)</Text>
            {managerName && (
              <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
                Gestor: {managerName}
              </Text>
            )}
          </View>
        </View>

        {/* RESUMEN */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>AUM TOTAL</Text>
            <Text style={styles.summaryValue}>${fmt(totalARS)}</Text>
            <Text style={styles.summarySubValue}>US$ {fmt(totalUSD)} MEP</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>HOY (1D)</Text>
            <Text style={[styles.summaryValue, pnlColor(dailyPnlARS)]}>
              {dailyPnlARS >= 0 ? '+' : ''}${fmt(dailyPnlARS)}
            </Text>
            <Text style={styles.summarySubValue}>vs. cierre anterior</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>P&L NO REALIZADO</Text>
            <Text style={[styles.summaryValue, pnlColor(pnlNoRealARS)]}>
              {pnlNoRealARS >= 0 ? '+' : ''}${fmt(pnlNoRealARS)}
            </Text>
            <Text style={styles.summarySubValue}>desde la compra</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>P&L REALIZADO</Text>
            <Text style={[styles.summaryValue, pnlColor(pnlRealARS)]}>
              {pnlRealARS >= 0 ? '+' : ''}${fmt(pnlRealARS)}
            </Text>
            <Text style={styles.summarySubValue}>operaciones cerradas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TIPOS DE CAMBIO</Text>
            <Text style={{ fontSize: 8, marginTop: 2 }}>MEP: ${fmt(fxRates.mep)}</Text>
            <Text style={{ fontSize: 8 }}>CCL: ${fmt(fxRates.ccl)}</Text>
            <Text style={{ fontSize: 8 }}>Oficial: ${fmt(fxRates.oficial)}</Text>
            <Text style={{ fontSize: 8, color: '#64748b' }}>Blue: ${fmt(fxRates.blue)}</Text>
          </View>
        </View>

        {/* POSICIONES POR TIPO */}
        {Object.entries(grouped).map(([type, rows]) => {
          const subtotalARS = rows.reduce((s, p) => s + (p.market_value_ars    ?? 0), 0)
          const subtotalUSD = rows.reduce((s, p) => s + (p.market_value_usd    ?? 0), 0)
          const subtotalPnl = rows.reduce((s, p) => s + (p.unrealized_pnl_ars  ?? 0), 0)
          const label       = TYPE_LABELS[type] ?? type

          return (
            <View key={type} style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>
                {label} ({rows.length} posición{rows.length !== 1 ? 'es' : ''})
              </Text>

              <View style={styles.tableHeader}>
                <Text style={styles.c_tick}>Ticker</Text>
                <Text style={styles.c_name}>Instrumento</Text>
                <Text style={styles.c_cant}>Cantidad</Text>
                <Text style={styles.c_ppp}>PPP ARS</Text>
                <Text style={styles.c_price}>Precio</Text>
                <Text style={styles.c_ars}>Valor ARS</Text>
                <Text style={styles.c_usd}>Valor USD</Text>
                <Text style={styles.c_pnl}>P&L ARS</Text>
                <Text style={styles.c_pct}>P&L %</Text>
                <Text style={styles.c_pct}>Hoy 1D</Text>
              </View>

              {rows.map((p, i) => {
                const pnlARS = p.unrealized_pnl_ars   ?? 0
                const pnlPct = p.unrealized_pnl_ars_pct ?? 0
                const daily  = p.daily_pnl_ars         ?? 0

                return (
                  <View
                    key={String(p.asset_id)}
                    style={i % 2 === 1
                      ? [styles.tableRow, styles.tableRowAlt]
                      : styles.tableRow
                    }
                  >
                    <Text style={styles.c_tick}>{p.ticker ?? '—'}</Text>
                    <Text style={styles.c_name}>
                      {String(p.asset_name ?? '—').substring(0, 28)}
                    </Text>
                    <Text style={styles.c_cant}>{fmt(Number(p.quantity_held ?? 0))}</Text>
                    <Text style={styles.c_ppp}>${fmt(Number(p.ppp_ars ?? 0))}</Text>
                    <Text style={styles.c_price}>${fmt(Number(p.current_price ?? 0))}</Text>
                    <Text style={styles.c_ars}>${fmt(Number(p.market_value_ars ?? 0))}</Text>
                    <Text style={styles.c_usd}>US${fmt(Number(p.market_value_usd ?? 0))}</Text>
                    <Text style={[styles.c_pnl, pnlColor(pnlARS)]}>
                      {pnlARS >= 0 ? '+' : ''}${fmt(pnlARS)}
                    </Text>
                    <Text style={[styles.c_pct, pnlColor(pnlPct)]}>
                      {fmtPct(pnlPct)}
                    </Text>
                    <Text style={[styles.c_pct, pnlColor(daily)]}>
                      {daily !== 0 ? `${daily >= 0 ? '+' : ''}${fmt(daily)}` : '—'}
                    </Text>
                  </View>
                )
              })}

              <View style={styles.tableRowTotal}>
                <Text style={styles.c_tick}></Text>
                <Text style={styles.c_name}>Subtotal {label}</Text>
                <Text style={styles.c_cant}></Text>
                <Text style={styles.c_ppp}></Text>
                <Text style={styles.c_price}></Text>
                <Text style={styles.c_ars}>${fmt(subtotalARS)}</Text>
                <Text style={styles.c_usd}>US${fmt(subtotalUSD)}</Text>
                <Text style={[styles.c_pnl, pnlColor(subtotalPnl)]}>
                  {subtotalPnl >= 0 ? '+' : ''}${fmt(subtotalPnl)}
                </Text>
                <Text style={styles.c_pct}></Text>
                <Text style={styles.c_pct}></Text>
              </View>
            </View>
          )
        })}

        {/* OPERACIONES CERRADAS */}
        {closedPositions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Operaciones Cerradas ({closedPositions.length})
            </Text>

            <View style={styles.tableHeader}>
              <Text style={styles.cc_tick}>Ticker</Text>
              <Text style={styles.cc_name}>Instrumento</Text>
              <Text style={styles.cc_date}>F. Compra</Text>
              <Text style={styles.cc_date}>F. Cierre</Text>
              <Text style={styles.cc_cost}>Costo Total</Text>
              <Text style={styles.cc_pnl}>P&L ARS</Text>
              <Text style={styles.cc_pct}>P&L %</Text>
              <Text style={styles.cc_pusd}>P&L USD</Text>
            </View>

            {closedPositions.map((p, i) => {
              const { ticker, name } = assetInfo(p.assets)
              const pnlARS = Number(p.realized_gain_loss_ars ?? 0)
              const pnlUSD = Number(p.realized_gain_loss_usd ?? 0)
              const cost   = Math.abs(Number(p.total_cost_basis_ars ?? 0))
              const pct    = cost > 0 ? pnlARS / cost : 0

              return (
                <View
                  key={i}
                  style={i % 2 === 1
                    ? [styles.tableRow, styles.tableRowAlt]
                    : styles.tableRow
                  }
                >
                  <Text style={styles.cc_tick}>{ticker}</Text>
                  <Text style={styles.cc_name}>{name.substring(0, 30)}</Text>
                  <Text style={styles.cc_date}>
                    {p.first_purchase_date
                      ? new Date(p.first_purchase_date).toLocaleDateString('es-AR')
                      : '—'}
                  </Text>
                  <Text style={styles.cc_date}>
                    {p.last_transaction_date
                      ? new Date(p.last_transaction_date).toLocaleDateString('es-AR')
                      : '—'}
                  </Text>
                  <Text style={styles.cc_cost}>${fmt(cost)}</Text>
                  <Text style={[styles.cc_pnl, pnlColor(pnlARS)]}>
                    {pnlARS >= 0 ? '+' : ''}${fmt(pnlARS)}
                  </Text>
                  <Text style={[styles.cc_pct, pnlColor(pct)]}>{fmtPct(pct)}</Text>
                  <Text style={[styles.cc_pusd, pnlColor(pnlUSD)]}>
                    {pnlUSD >= 0 ? '+' : ''}US${fmt(pnlUSD)}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* NOTA BONOS USD */}
        {hasBondUSD && (
          <View style={styles.noteBox}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>
              Nota sobre bonos denominados en dólares:
            </Text>
            <Text>
              Los bonos soberanos en USD (GD38, AE38, AL30, etc.) están denominados en dólares
              estadounidenses. El valor en pesos surge de convertir el precio en USD al tipo de cambio
              MEP vigente. La variación en pesos puede diferir significativamente de la variación en
              dólares por efecto del tipo de cambio. Para estos instrumentos, el indicador relevante
              de rendimiento es en USD.
            </Text>
          </View>
        )}

        {/* DISCLAIMER */}
        <View style={styles.disclaimer}>
          <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>Aviso importante:</Text>
          <Text>
            Los precios provienen de Invertir Online (IOL / BYMA) y pueden tener una demora de hasta
            20 minutos respecto al precio en tiempo real. Para operar, verificar el precio vigente al
            momento de la orden con su broker. Este informe es informativo y no constituye
            asesoramiento de inversión. Los rendimientos pasados no garantizan resultados futuros.
          </Text>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {client.full_name} — {portfolio.name} — {dateStr}
          </Text>
          <Text style={styles.footerText}>
            Precios: IOL API (TradFi) · CoinGecko (Crypto) · dolarapi.com (FX)
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  )
}

export async function renderPortfolioReportToBuffer(props: ReportProps): Promise<Buffer> {
  return renderToBuffer(<PortfolioReport {...props} />)
}
