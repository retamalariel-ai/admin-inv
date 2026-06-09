'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { RefreshCw, TrendingUp, Bitcoin, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Asset    = Database['public']['Tables']['assets']['Row']
type FXRate   = Database['public']['Tables']['fx_rates']['Row']
type AssetType = Database['public']['Enums']['asset_type']

interface PriceRow {
  asset_id:   string
  quote_date: string
  quote_time: string | null
  price:      number
  currency:   string
  source:     string
  assets:     { ticker: string; name: string; asset_type: AssetType } | null
}

interface SystemStats {
  totalTransactions: number
  activeClients:     number
  totalAumUsd:       number
  lastPriceUpdate:   string | null
  appVersion:        string
}

interface Props {
  assets:       Asset[]
  fxRates:      FXRate[]
  latestPrices: PriceRow[]
  systemStats:  SystemStats
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  ACCION_LOCAL:        'Acción',
  CEDEAR:              'CEDEAR',
  BONO_SOBERANO:       'Bono Sob.',
  BONO_SUBSOBERANO:    'Bono Sub.',
  ON:                  'ON',
  LETES:               'LETES',
  LECAP:               'LECAP',
  FCI_MONEY_MARKET:    'FCI MM',
  FCI_RENTA_FIJA:      'FCI RF',
  FCI_RENTA_VARIABLE:  'FCI RV',
  FCI_RENTA_MIXTA:     'FCI Mix',
  CRYPTO_SPOT:         'Spot',
  CRYPTO_STABLECOIN:   'Stable',
  CRYPTO_EARN:         'Earn',
  CRYPTO_DEFI_LP:      'DeFi LP',
  CRYPTO_DEFI_STAKE:   'Stake',
  CRYPTO_DEFI_LENDING: 'Lending',
  CASH_ARS:            'Cash ARS',
  CASH_USD_MEP:        'Cash USD',
  CASH_USD_CCL:        'Cash CCL',
  CASH_CRYPTO_STABLE:  'Cash Stbl',
  CASH_CRYPTO_NATIVE:  'Cash Nat.',
}

function rfColor(f: number): string {
  if (f > 0.8) return 'bg-emerald-900/60 text-emerald-300'
  if (f >= 0.5) return 'bg-yellow-900/60 text-yellow-300'
  return 'bg-red-900/60 text-red-300'
}

const BOND_TYPES = ['BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP']

export default function ConfigDashboard({ assets, fxRates, latestPrices, systemStats }: Props) {
  const router    = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [editRf,  setEditRf]  = useState<Record<string, string>>({})

  async function callEndpoint(path: string, method: 'POST' | 'GET' = 'POST', label: string) {
    setLoading(label)
    try {
      const res  = await fetch(path, { method })
      const data = await res.json() as Record<string, unknown>
      if (res.ok) {
        toast.success(`${label} completado — ${data.assetsUpdated ?? data.success ?? 'ok'}`)
        router.refresh()
      } else {
        toast.error(`Error: ${data.error ?? data.detail ?? 'desconocido'}`)
      }
    } catch (e) {
      toast.error(`Error de red: ${String(e)}`)
    } finally {
      setLoading(null)
    }
  }

  async function updateRF(assetId: string, rfStr: string) {
    const rf = parseFloat(rfStr)
    if (isNaN(rf) || rf < 0 || rf > 1) {
      toast.error('El residual factor debe estar entre 0 y 1')
      return
    }
    const supabase = createClient()
    const { error } = await supabase
      .from('assets')
      .update({ current_residual_factor: rf, residual_factor_updated_at: new Date().toISOString() })
      .eq('id', assetId)
    if (error) { toast.error(error.message); return }
    toast.success('Residual factor actualizado')
    setEditRf(prev => { const n = { ...prev }; delete n[assetId]; return n })
    router.refresh()
  }

  async function toggleActive(assetId: string, current: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('assets')
      .update({ is_active: !current })
      .eq('id', assetId)
    if (error) { toast.error(error.message); return }
    toast.success(!current ? 'Activo activado' : 'Activo desactivado')
    router.refresh()
  }

  const Spinner = () => <RefreshCw className="h-3 w-3 animate-spin" />

  return (
    <Tabs defaultValue="assets">
      <TabsList className="bg-slate-800 mb-6">
        <TabsTrigger value="assets">Activos</TabsTrigger>
        <TabsTrigger value="prices">Precios</TabsTrigger>
        <TabsTrigger value="fx">Tipos de Cambio</TabsTrigger>
        <TabsTrigger value="system">Sistema</TabsTrigger>
      </TabsList>

      {/* ── TAB 1: Activos ──────────────────────────────────────────────── */}
      <TabsContent value="assets" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{assets.length} activos registrados</p>
        </div>
        <div className="rounded-lg border border-slate-700 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead>Ticker</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-center">Residual Factor</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(a => {
                const isBond = BOND_TYPES.includes(a.asset_type)
                const rf     = a.current_residual_factor
                const rfEdit = editRf[a.id]

                return (
                  <TableRow key={a.id} className={`border-slate-700 hover:bg-slate-800/50 ${!a.is_active ? 'opacity-40' : ''}`}>
                    <TableCell className="font-mono font-semibold text-slate-100">{a.ticker}</TableCell>
                    <TableCell className="text-slate-300 text-sm max-w-[200px] truncate">{a.name}</TableCell>
                    <TableCell>
                      <Badge className="text-xs bg-slate-700/60 text-slate-300">
                        {ASSET_TYPE_LABELS[a.asset_type] ?? a.asset_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">{a.currency}</TableCell>
                    <TableCell className="text-center">
                      {isBond ? (
                        rfEdit !== undefined ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              max="1"
                              value={rfEdit}
                              onChange={e => setEditRf(prev => ({ ...prev, [a.id]: e.target.value }))}
                              className="w-20 text-xs bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-slate-100 tabular-nums"
                            />
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-emerald-400"
                              onClick={() => updateRF(a.id, rfEdit)}>
                              ✓
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-slate-500"
                              onClick={() => setEditRf(prev => { const n = { ...prev }; delete n[a.id]; return n })}>
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditRf(prev => ({ ...prev, [a.id]: String(rf) }))}
                            className="inline-flex"
                          >
                            <Badge className={`text-xs font-mono cursor-pointer hover:opacity-80 ${rfColor(rf)}`}>
                              {(rf * 100).toFixed(1)}%
                            </Badge>
                          </button>
                        )
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleActive(a.id, a.is_active)}
                        className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                          a.is_active
                            ? 'bg-emerald-900/60 text-emerald-300 hover:bg-red-900/40'
                            : 'bg-slate-700/60 text-slate-400 hover:bg-emerald-900/40'
                        }`}
                      >
                        {a.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{a.data_source}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ── TAB 2: Precios ──────────────────────────────────────────────── */}
      <TabsContent value="prices" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            disabled={!!loading}
            onClick={() => callEndpoint('/api/market/update-all', 'POST', 'Actualizar Todo')}
          >
            {loading === 'Actualizar Todo' ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            Actualizar Todo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={!!loading}
            onClick={() => callEndpoint('/api/prices/tradfi', 'POST', 'TradFi')}
          >
            {loading === 'TradFi' ? <Spinner /> : <TrendingUp className="h-4 w-4" />}
            Actualizar TradFi
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={!!loading}
            onClick={() => callEndpoint('/api/prices/crypto', 'POST', 'Crypto')}
          >
            {loading === 'Crypto' ? <Spinner /> : <Bitcoin className="h-4 w-4" />}
            Actualizar Crypto
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={!!loading}
            onClick={() => callEndpoint('/api/fx-rates/update', 'POST', 'FX')}
          >
            {loading === 'FX' ? <Spinner /> : <DollarSign className="h-4 w-4" />}
            Actualizar FX
          </Button>
        </div>

        <div className="rounded-lg border border-slate-700 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead>Ticker</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latestPrices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Sin cotizaciones. Presioná "Actualizar Todo".
                  </TableCell>
                </TableRow>
              )}
              {latestPrices.map((p, i) => (
                <TableRow key={`price-${p.asset_id}-${i}`}
                  className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="font-mono text-slate-100">{p.assets?.ticker ?? '—'}</TableCell>
                  <TableCell className="text-slate-300 text-sm max-w-[180px] truncate">
                    {p.assets?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className="text-xs bg-slate-700/60 text-slate-300">
                      {p.assets?.asset_type ? ASSET_TYPE_LABELS[p.assets.asset_type] ?? p.assets.asset_type : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-100 font-medium">
                    {new Decimal(p.price).toFixed(p.price < 10 ? 6 : 2)}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs">{p.currency}</TableCell>
                  <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                    {p.quote_date}{p.quote_time ? ` ${p.quote_time.slice(0, 5)}` : ''}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs">{p.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ── TAB 3: Tipos de Cambio ──────────────────────────────────────── */}
      <TabsContent value="fx" className="space-y-4">
        <p className="text-sm text-slate-400">Últimos 30 registros</p>
        <div className="rounded-lg border border-slate-700 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead className="text-right">MEP</TableHead>
                <TableHead className="text-right">CCL</TableHead>
                <TableHead className="text-right">Oficial</TableHead>
                <TableHead className="text-right">Blue</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fxRates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Sin registros FX
                  </TableCell>
                </TableRow>
              )}
              {fxRates.map(r => (
                <TableRow key={r.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-slate-300 tabular-nums">{r.rate_date}</TableCell>
                  <TableCell className="text-slate-500 text-xs tabular-nums">
                    {r.rate_time?.slice(0, 5) ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-100">
                    {r.rate_mep != null ? new Decimal(r.rate_mep).toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-100">
                    {r.rate_ccl != null ? new Decimal(r.rate_ccl).toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-300">
                    {r.rate_oficial != null ? new Decimal(r.rate_oficial).toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-300">
                    {r.rate_blue != null ? new Decimal(r.rate_blue).toFixed(2) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className="text-xs bg-slate-700/60 text-slate-400">{r.source}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* ── TAB 4: Sistema ──────────────────────────────────────────────── */}
      <TabsContent value="system" className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Versión</p>
            <p className="text-lg font-mono text-emerald-400">v{systemStats.appVersion}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Clientes Activos</p>
            <p className="text-2xl font-bold text-slate-100">{systemStats.activeClients}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Transacciones (total)</p>
            <p className="text-2xl font-bold text-slate-100">
              {systemStats.totalTransactions.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 col-span-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">AUM Total USD</p>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">
              {new Decimal(systemStats.totalAumUsd).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} USD
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Última actualización</p>
            <p className="text-lg text-slate-300 tabular-nums">
              {systemStats.lastPriceUpdate ?? '—'}
            </p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Endpoints de mercado</h3>
          <div className="space-y-2 text-xs font-mono text-slate-400">
            <div className="flex justify-between">
              <span>POST /api/market/update-all</span>
              <span className="text-slate-600">Orquestador (+ cron Vercel)</span>
            </div>
            <div className="flex justify-between">
              <span>POST /api/prices/tradfi</span>
              <span className="text-slate-600">PPI API — 33 tickers</span>
            </div>
            <div className="flex justify-between">
              <span>POST /api/prices/crypto</span>
              <span className="text-slate-600">CoinGecko</span>
            </div>
            <div className="flex justify-between">
              <span>POST /api/fx-rates/update</span>
              <span className="text-slate-600">PPI (MEP/CCL) + dolarapi (Oficial/Blue)</span>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
