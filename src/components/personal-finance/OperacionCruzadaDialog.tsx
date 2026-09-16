'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AccRow, CatRow } from './TransaccionesDashboard'

// ── Tipos ──────────────────────────────────────────────────────────────────────
type TipoOperacion = 'RESCATE_A_CUENTA' | 'GASTO_TD_COCOS' | 'GASTO_NEXO_CARD' | 'INGRESO_COMITENTE'

interface Props {
  open:        boolean
  onClose:     () => void
  onSuccess:   () => void
  accounts:    AccRow[]
  categories:  CatRow[]
}

// ── Datos hardcodeados ────────────────────────────────────────────────────────
const PORTFOLIOS = [
  { id: 'c081f560-deee-4d7b-bd61-322609471b1c', name: 'Cartera Principal' },
  { id: 'ac7b4dab-a8ce-46a1-80d1-ef116712a24f', name: 'Binance Spot CEX' },
  { id: '535f1419-cf5f-4963-97c3-b4b60afef1ab', name: 'Nexo Earn CeFi' },
  { id: '5589925e-7aa7-47a3-94b5-2543bb6bb146', name: 'SafePal Wallet' },
  { id: 'c769f338-1193-4867-abc1-a32633ed54d6', name: 'DeFi Protocols' },
]

// Fondos Cocos usados con la Tarjeta Débito Cocos
const FCI_COCOS = [
  { asset_id: '565c8cc0-2a82-46df-85ef-5c90c47aa939', portfolio_id: 'c081f560-deee-4d7b-bd61-322609471b1c', name: 'COCORMA' },
  { asset_id: '75f164cc-4488-4991-83a3-1e8346b3f77c', portfolio_id: 'c081f560-deee-4d7b-bd61-322609471b1c', name: 'COCOSPPA' },
  { asset_id: '2bc2bf41-769e-470b-bcf2-408a9c70f421', portfolio_id: 'c081f560-deee-4d7b-bd61-322609471b1c', name: 'COCOUSDPA' },
  { asset_id: '114be91f-8ae3-496f-9303-11639c597ae1', portfolio_id: 'c081f560-deee-4d7b-bd61-322609471b1c', name: 'COCOAUSD' },
]

// Portfolio de Nexo Earn CeFi para GASTO_NEXO_CARD
const NEXO_PORTFOLIO_ID = '535f1419-cf5f-4963-97c3-b4b60afef1ab'

// Cuenta comitente por defecto para INGRESO_COMITENTE
const CUENTA_COMITENTE_ID = '5d993bf0-9fc6-4c6a-9344-f38b84e9ffc4'

const MONEDAS = ['ARS', 'USD', 'USDT', 'EUR']

const today = () => new Date().toISOString().slice(0, 10)

// ── Helpers de formulario ─────────────────────────────────────────────────────
function FormInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

function FormSelect({
  label, children, ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select
        {...props}
        className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {children}
      </select>
    </div>
  )
}

// ── Estado inicial del formulario ─────────────────────────────────────────────
const EMPTY_FORM = {
  tipo:           'RESCATE_A_CUENTA' as TipoOperacion,
  fecha:          today(),
  descripcion:    '',
  monto:          '',
  moneda:         'ARS',
  categoria_id:   '',
  fx_rate_mep:    '',
  // RESCATE_A_CUENTA
  portfolio_id:   '',
  asset_id:       '',
  quantity:       '',
  price_per_unit: '',
  cuenta_id:      '',
  // GASTO_TD_COCOS
  fci_key:        '', // index into FCI_COCOS
  // GASTO_NEXO_CARD
  nexo_quantity:  '',
  nexo_price_usd: '',
  // INGRESO_COMITENTE
  notas:          '',
}

interface AssetOption { id: string; ticker: string; name: string }

// ── Componente principal ──────────────────────────────────────────────────────
export default function OperacionCruzadaDialog({ open, onClose, onSuccess, accounts, categories }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [assets,  setAssets]  = useState<AssetOption[]>([])

  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Calcular monto derivado para RESCATE_A_CUENTA
  const derivedMonto = form.quantity && form.price_per_unit
    ? (parseFloat(form.quantity) * parseFloat(form.price_per_unit)).toFixed(2)
    : ''

  // Fetch de assets al cambiar portfolio (RESCATE_A_CUENTA)
  const fetchAssets = useCallback(async (portfolioId: string) => {
    if (!portfolioId) { setAssets([]); return }
    const { data } = await db
      .from('transactions')
      .select('asset_id, assets(id, ticker, name)')
      .eq('portfolio_id', portfolioId)
      .not('asset_id', 'is', null)
    if (!data) return
    const seen = new Set<string>()
    const opts: AssetOption[] = []
    for (const row of data) {
      const a = row.assets
      if (a && !seen.has(a.id)) { seen.add(a.id); opts.push({ id: a.id, ticker: a.ticker, name: a.name }) }
    }
    setAssets(opts.sort((a, b) => a.ticker.localeCompare(b.ticker)))
  }, [db])

  // Fetch precio de NEXO al abrir el diálogo
  const fetchNexoPrice = useCallback(async () => {
    const { data } = await db
      .from('price_quotes')
      .select('price')
      .eq('asset_id', 'd9150768-4186-4d12-b7db-6cdb9ea46a8b') // NEXO_ASSET_ID
      .order('quote_date', { ascending: false })
      .limit(1)
      .single()
    if (data?.price) set('nexo_price_usd', String(data.price))
  }, [db])

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY_FORM, fecha: today() })
    setAssets([])
  }, [open])

  useEffect(() => {
    if (form.tipo === 'GASTO_NEXO_CARD') fetchNexoPrice()
  }, [form.tipo, fetchNexoPrice])

  useEffect(() => {
    if (form.tipo === 'RESCATE_A_CUENTA') fetchAssets(form.portfolio_id)
  }, [form.tipo, form.portfolio_id, fetchAssets])

  // Categorías filtradas por tipo de la operación personal
  const ingressCats = categories.filter(c => c.type === 'INGRESO')
  const egressCats  = categories.filter(c => c.type === 'EGRESO')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let body: Record<string, unknown>

      switch (form.tipo) {
        case 'RESCATE_A_CUENTA': {
          if (!form.portfolio_id || !form.asset_id || !form.quantity || !form.price_per_unit || !form.cuenta_id) {
            toast.error('Completar: portfolio, activo, cantidad, precio y cuenta destino'); return
          }
          const qty = parseFloat(form.quantity)
          const ppu = parseFloat(form.price_per_unit)
          body = {
            tipo:          'RESCATE_A_CUENTA',
            fecha:         form.fecha,
            monto:         qty * ppu,
            moneda:        form.moneda,
            descripcion:   form.descripcion || 'Rescate a cuenta',
            portfolio_id:  form.portfolio_id,
            asset_id:      form.asset_id,
            quantity:      qty,
            price_per_unit: ppu,
            fx_rate_mep:   form.fx_rate_mep ? parseFloat(form.fx_rate_mep) : null,
            cuenta_id:     form.cuenta_id,
            categoria_id:  form.categoria_id || null,
          }
          break
        }
        case 'GASTO_TD_COCOS': {
          if (!form.fci_key || !form.monto || !form.price_per_unit) {
            toast.error('Completar: FCI, monto y precio por cuotaparte'); return
          }
          const fci  = FCI_COCOS[parseInt(form.fci_key)]
          const monto = parseFloat(form.monto)
          const ppu  = parseFloat(form.price_per_unit)
          body = {
            tipo:          'GASTO_TD_COCOS',
            fecha:         form.fecha,
            monto,
            moneda:        'ARS',
            descripcion:   form.descripcion || 'Gasto TD Cocos',
            portfolio_id:  fci.portfolio_id,
            asset_id:      fci.asset_id,
            quantity:      monto / ppu,
            price_per_unit: ppu,
            fx_rate_mep:   form.fx_rate_mep ? parseFloat(form.fx_rate_mep) : null,
            categoria_id:  form.categoria_id || null,
          }
          break
        }
        case 'GASTO_NEXO_CARD': {
          if (!form.nexo_quantity || !form.nexo_price_usd || !form.monto) {
            toast.error('Completar: monto USD, cantidad NEXO y precio NEXO'); return
          }
          body = {
            tipo:           'GASTO_NEXO_CARD',
            fecha:          form.fecha,
            monto:          parseFloat(form.monto),
            moneda:         'USD',
            descripcion:    form.descripcion || 'Gasto Nexo Card',
            portfolio_id:   NEXO_PORTFOLIO_ID,
            nexo_quantity:  parseFloat(form.nexo_quantity),
            nexo_price_usd: parseFloat(form.nexo_price_usd),
            categoria_id:   form.categoria_id || null,
            cuenta_id:      form.cuenta_id || null,
          }
          break
        }
        case 'INGRESO_COMITENTE': {
          if (!form.monto) { toast.error('Monto es requerido'); return }
          body = {
            tipo:         'INGRESO_COMITENTE',
            fecha:        form.fecha,
            monto:        parseFloat(form.monto),
            moneda:       form.moneda,
            descripcion:  form.descripcion || 'Ingreso comitente',
            fx_rate_mep:  form.fx_rate_mep ? parseFloat(form.fx_rate_mep) : null,
            categoria_id: form.categoria_id || null,
            cuenta_id:    form.cuenta_id || null,
            notas:        form.notas || null,
          }
          break
        }
      }

      const res = await fetch('/api/operaciones/cruzadas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body!),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Error en la operación')

      toast.success('Operación registrada correctamente')
      onSuccess()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const TIPO_LABELS: Record<TipoOperacion, string> = {
    RESCATE_A_CUENTA:  'Rescate → Cuenta personal',
    GASTO_TD_COCOS:    'Gasto TD Cocos (rescata FCI)',
    GASTO_NEXO_CARD:   'Gasto Nexo Card (retira NEXO)',
    INGRESO_COMITENTE: 'Ingreso en cuenta comitente',
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Operación cruzada</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registra simultáneamente en inversiones y finanzas personales
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Tipo de operación */}
          <FormSelect
            label="Tipo de operación *"
            value={form.tipo}
            onChange={e => {
              const newTipo = e.target.value as TipoOperacion
              setForm({
                ...EMPTY_FORM,
                fecha:    form.fecha,
                tipo:     newTipo,
                cuenta_id: newTipo === 'INGRESO_COMITENTE' ? CUENTA_COMITENTE_ID : '',
              })
              setAssets([])
            }}
          >
            {(Object.keys(TIPO_LABELS) as TipoOperacion[]).map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </FormSelect>

          {/* Fecha + descripción (común a todos) */}
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Fecha *"
              type="date"
              value={form.fecha}
              onChange={e => set('fecha', e.target.value)}
              required
            />
            <FormInput
              label="Descripción"
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {/* ── RESCATE_A_CUENTA ─────────────────────────────────────────────── */}
          {form.tipo === 'RESCATE_A_CUENTA' && (<>
            <FormSelect
              label="Portfolio *"
              value={form.portfolio_id}
              onChange={e => { set('portfolio_id', e.target.value); set('asset_id', '') }}
            >
              <option value="">Seleccionar portfolio</option>
              {PORTFOLIOS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </FormSelect>

            <FormSelect
              label="Activo *"
              value={form.asset_id}
              onChange={e => set('asset_id', e.target.value)}
              disabled={assets.length === 0}
            >
              <option value="">{assets.length === 0 ? 'Seleccionar portfolio primero' : 'Seleccionar activo'}</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.ticker} — {a.name}</option>
              ))}
            </FormSelect>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Cantidad *"
                type="number"
                min={0}
                step="any"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                placeholder="0"
              />
              <FormInput
                label="Precio por unidad *"
                type="number"
                min={0}
                step="any"
                value={form.price_per_unit}
                onChange={e => set('price_per_unit', e.target.value)}
                placeholder="0"
              />
            </div>

            {derivedMonto && (
              <p className="text-xs text-muted-foreground -mt-1">
                Importe calculado: <span className="text-foreground font-medium">{parseFloat(derivedMonto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Moneda"
                value={form.moneda}
                onChange={e => set('moneda', e.target.value)}
              >
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </FormSelect>
              {form.moneda !== 'ARS' && (
                <FormInput
                  label="TC MEP (→ ARS)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.fx_rate_mep}
                  onChange={e => set('fx_rate_mep', e.target.value)}
                  placeholder="0"
                />
              )}
            </div>

            <FormSelect
              label="Acreditar en cuenta *"
              value={form.cuenta_id}
              onChange={e => set('cuenta_id', e.target.value)}
            >
              <option value="">Seleccionar cuenta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </FormSelect>

            <FormSelect
              label="Categoría"
              value={form.categoria_id}
              onChange={e => set('categoria_id', e.target.value)}
            >
              <option value="">Sin categoría</option>
              {ingressCats.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
              ))}
            </FormSelect>
          </>)}

          {/* ── GASTO_TD_COCOS ───────────────────────────────────────────────── */}
          {form.tipo === 'GASTO_TD_COCOS' && (<>
            <FormSelect
              label="Fondo Cocos *"
              value={form.fci_key}
              onChange={e => set('fci_key', e.target.value)}
            >
              <option value="">Seleccionar FCI</option>
              {FCI_COCOS.map((f, i) => (
                <option key={f.asset_id} value={String(i)}>{f.name}</option>
              ))}
            </FormSelect>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Monto del gasto (ARS) *"
                type="number"
                min={0}
                step="0.01"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
                placeholder="0"
              />
              <FormInput
                label="VCP / Precio cuotaparte *"
                type="number"
                min={0}
                step="any"
                value={form.price_per_unit}
                onChange={e => set('price_per_unit', e.target.value)}
                placeholder="0"
              />
            </div>

            {form.monto && form.price_per_unit && (
              <p className="text-xs text-muted-foreground -mt-1">
                Cuotapartes a rescatar:{' '}
                <span className="text-foreground font-medium">
                  {(parseFloat(form.monto) / parseFloat(form.price_per_unit)).toFixed(6)}
                </span>
              </p>
            )}

            <FormInput
              label="TC MEP (opcional)"
              type="number"
              min={0}
              step="0.01"
              value={form.fx_rate_mep}
              onChange={e => set('fx_rate_mep', e.target.value)}
              placeholder="Para referencia"
            />

            <FormSelect
              label="Categoría"
              value={form.categoria_id}
              onChange={e => set('categoria_id', e.target.value)}
            >
              <option value="">Sin categoría</option>
              {egressCats.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
              ))}
            </FormSelect>
          </>)}

          {/* ── GASTO_NEXO_CARD ──────────────────────────────────────────────── */}
          {form.tipo === 'GASTO_NEXO_CARD' && (<>
            <FormInput
              label="Monto del gasto (USD) *"
              type="number"
              min={0}
              step="0.01"
              value={form.monto}
              onChange={e => set('monto', e.target.value)}
              placeholder="0.00"
            />

            <FormSelect
              label="Cuenta origen"
              value={form.cuenta_id}
              onChange={e => set('cuenta_id', e.target.value)}
            >
              <option value="">Efectivo USD (por defecto)</option>
              {accounts
                .filter(a => a.currency === 'USD' || a.currency === 'USDT')
                .map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </FormSelect>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Cantidad NEXO debitada *"
                type="number"
                min={0}
                step="any"
                value={form.nexo_quantity}
                onChange={e => set('nexo_quantity', e.target.value)}
                placeholder="0"
              />
              <FormInput
                label="Precio NEXO (USD) *"
                type="number"
                min={0}
                step="0.0001"
                value={form.nexo_price_usd}
                onChange={e => set('nexo_price_usd', e.target.value)}
                placeholder="Cargando…"
              />
            </div>

            {form.nexo_quantity && form.nexo_price_usd && (
              <p className="text-xs text-muted-foreground -mt-1">
                Valor NEXO: USD{' '}
                <span className="text-foreground font-medium">
                  {(parseFloat(form.nexo_quantity) * parseFloat(form.nexo_price_usd)).toFixed(4)}
                </span>
              </p>
            )}

            <FormSelect
              label="Categoría"
              value={form.categoria_id}
              onChange={e => set('categoria_id', e.target.value)}
            >
              <option value="">Sin categoría</option>
              {egressCats.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
              ))}
            </FormSelect>
          </>)}

          {/* ── INGRESO_COMITENTE ────────────────────────────────────────────── */}
          {form.tipo === 'INGRESO_COMITENTE' && (<>
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Monto *"
                type="number"
                min={0}
                step="0.01"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
                placeholder="0"
              />
              <FormSelect
                label="Moneda"
                value={form.moneda}
                onChange={e => {
                  const m = e.target.value
                  set('moneda', m)
                  set('cuenta_id', m === 'ARS' ? CUENTA_COMITENTE_ID : '')
                }}
              >
                {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </FormSelect>
            </div>

            {form.moneda !== 'ARS' && (
              <FormInput
                label="TC MEP (→ ARS)"
                type="number"
                min={0}
                step="0.01"
                value={form.fx_rate_mep}
                onChange={e => set('fx_rate_mep', e.target.value)}
                placeholder="0"
              />
            )}

            <FormSelect
              label="Cuenta de acreditación *"
              value={form.cuenta_id}
              onChange={e => set('cuenta_id', e.target.value)}
            >
              <option value="">Seleccionar cuenta</option>
              {accounts
                .filter(a => a.currency === form.moneda)
                .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </FormSelect>

            <FormSelect
              label="Categoría"
              value={form.categoria_id}
              onChange={e => set('categoria_id', e.target.value)}
            >
              <option value="">Sin categoría</option>
              {ingressCats.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
              ))}
            </FormSelect>

            <FormInput
              label="Notas (opcional)"
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Información adicional"
            />
          </>)}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={loading}
            >
              {loading ? 'Registrando…' : 'Registrar operación'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
