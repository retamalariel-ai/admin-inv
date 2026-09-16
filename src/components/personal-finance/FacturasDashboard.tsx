'use client'

import { useMemo, useState } from 'react'
import { Plus, ExternalLink, Pencil, Ban, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AccRow } from './TransaccionesDashboard'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type FacturaRow = {
  id:              string
  numero:          string
  fecha_emision:   string
  fecha_cobro:     string | null
  cliente_nombre:  string
  cliente_cuit:    string | null
  concepto:        string
  monto:           number
  moneda:          string
  estado:          'EMITIDA' | 'COBRADA' | 'VENCIDA' | 'ANULADA'
  cuenta_cobro_id: string | null
  notas:           string | null
  arca_link:       string | null
  created_at:      string
}

interface Props {
  initialFacturas: FacturaRow[]
  accounts:        AccRow[]
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const ARCA_URL        = 'https://facturador.afip.gob.ar'
const ID_HONORARIOS   = '8226f82d-992e-497d-b949-72ffabf6b3a4'
const PUNTO_VENTA_DEFAULT = '0001'

const ESTADO_BADGE: Record<string, string> = {
  EMITIDA: 'bg-amber-900/60 text-amber-300',
  COBRADA: 'bg-emerald-900/60 text-emerald-300',
  VENCIDA: 'bg-red-900/60 text-red-300',
  ANULADA: 'bg-slate-700/60 text-slate-400',
}

const today = () => new Date().toISOString().slice(0, 10)

function fmtDate(s: string | null) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function fmtMonto(amount: number, moneda: string) {
  if (moneda === 'ARS')
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  return amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + moneda
}

function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentYear() {
  return String(new Date().getFullYear())
}

// Sugiere el próximo número de comprobante basado en el último registrado
function nextNumero(facturas: FacturaRow[]): string {
  if (facturas.length === 0) return `${PUNTO_VENTA_DEFAULT}-00000001`
  const ultimo = facturas
    .map(f => f.numero)
    .filter(n => n.includes('-'))
    .map(n => {
      const parts = n.split('-')
      return { pv: parts[0], seq: parseInt(parts[1] ?? '0', 10) }
    })
    .sort((a, b) => b.seq - a.seq)[0]
  if (!ultimo) return `${PUNTO_VENTA_DEFAULT}-00000001`
  const next = String(ultimo.seq + 1).padStart(8, '0')
  return `${ultimo.pv}-${next}`
}

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

function FormTextarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <textarea
        {...props}
        rows={2}
        className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
      />
    </div>
  )
}

function FormSelect({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
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

// ── Estado de formulario ──────────────────────────────────────────────────────
const EMPTY_FACTURA = {
  numero:         '',
  fecha_emision:  today(),
  cliente_nombre: '',
  cliente_cuit:   '',
  concepto:       '',
  monto:          '',
  moneda:         'ARS',
  notas:          '',
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FacturasDashboard({ initialFacturas, accounts }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [facturas, setFacturas] = useState<FacturaRow[]>(initialFacturas)
  const [loading,  setLoading]  = useState<string | null>(null)

  // ── Modal: nueva/editar factura ────────────────────────────────────────────
  const [openNew,  setOpenNew]  = useState(false)
  const [editFact, setEditFact] = useState<FacturaRow | null>(null)
  const [form,     setForm]     = useState(EMPTY_FACTURA)
  const set = (k: keyof typeof EMPTY_FACTURA, v: string) => setForm(f => ({ ...f, [k]: v }))

  // ── Modal: marcar cobrada ─────────────────────────────────────────────────
  const [cobrarFact,     setCobrarFact]     = useState<FacturaRow | null>(null)
  const [cobrarFecha,    setCobrarFecha]    = useState(today())
  const [cobrarCuentaId, setCobrarCuentaId] = useState('')

  // ── Métricas ──────────────────────────────────────────────────────────────
  const ym  = currentYM()
  const yr  = currentYear()

  const metrics = useMemo(() => {
    const emitidoMes = facturas
      .filter(f => f.fecha_emision.startsWith(ym) && f.estado !== 'ANULADA')
      .reduce((s, f) => s + f.monto, 0)
    const cobradoMes = facturas
      .filter(f => f.fecha_cobro?.startsWith(ym) && f.estado === 'COBRADA')
      .reduce((s, f) => s + f.monto, 0)
    const pendientes = facturas.filter(f => f.estado === 'EMITIDA').length
    const totalAnio  = facturas
      .filter(f => f.fecha_emision.startsWith(yr) && f.estado !== 'ANULADA')
      .reduce((s, f) => s + f.monto, 0)
    return { emitidoMes, cobradoMes, pendientes, totalAnio }
  }, [facturas, ym, yr])

  function fmtARS(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  }

  // ── Abrir dialog nueva ────────────────────────────────────────────────────
  function openNewDialog() {
    setEditFact(null)
    setForm({ ...EMPTY_FACTURA, fecha_emision: today(), numero: nextNumero(facturas) })
    setOpenNew(true)
  }

  function openEditDialog(f: FacturaRow) {
    setEditFact(f)
    setForm({
      numero:         f.numero,
      fecha_emision:  f.fecha_emision,
      cliente_nombre: f.cliente_nombre,
      cliente_cuit:   f.cliente_cuit ?? '',
      concepto:       f.concepto,
      monto:          String(f.monto),
      moneda:         f.moneda,
      notas:          f.notas ?? '',
    })
    setOpenNew(true)
  }

  // ── Guardar factura ───────────────────────────────────────────────────────
  async function saveFactura() {
    if (!form.numero || !form.cliente_nombre || !form.concepto || !form.monto) {
      toast.error('Número, cliente, concepto y monto son requeridos'); return
    }
    setLoading('save')
    const payload = {
      numero:         form.numero.trim(),
      fecha_emision:  form.fecha_emision,
      cliente_nombre: form.cliente_nombre.trim(),
      cliente_cuit:   form.cliente_cuit.trim() || null,
      concepto:       form.concepto.trim(),
      monto:          parseFloat(form.monto),
      moneda:         form.moneda,
      notas:          form.notas.trim() || null,
    }

    try {
      if (editFact) {
        const { data, error } = await db
          .from('personal_facturas')
          .update(payload)
          .eq('id', editFact.id)
          .select('*')
          .single()
        if (error) throw error
        setFacturas(prev => prev.map(f => f.id === editFact.id ? data : f))
        toast.success('Factura actualizada')
      } else {
        const { data, error } = await db
          .from('personal_facturas')
          .insert(payload)
          .select('*')
          .single()
        if (error) throw error
        setFacturas(prev => [data, ...prev])
        toast.success('Factura registrada')
      }
      setOpenNew(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  // ── Anular factura ────────────────────────────────────────────────────────
  async function anularFactura(id: string) {
    if (!confirm('¿Anular esta factura?')) return
    setLoading('anular-' + id)
    const { error } = await db
      .from('personal_facturas')
      .update({ estado: 'ANULADA' })
      .eq('id', id)
    if (error) { toast.error(error.message); setLoading(null); return }
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado: 'ANULADA' as const } : f))
    toast.success('Factura anulada')
    setLoading(null)
  }

  // ── Marcar cobrada ────────────────────────────────────────────────────────
  function openCobrar(f: FacturaRow) {
    setCobrarFact(f)
    setCobrarFecha(today())
    setCobrarCuentaId(accounts[0]?.id ?? '')
  }

  async function confirmarCobro() {
    if (!cobrarFact || !cobrarFecha || !cobrarCuentaId) {
      toast.error('Fecha y cuenta son requeridas'); return
    }
    setLoading('cobrar')
    try {
      // 1. Actualizar estado en DB
      const { data, error } = await db
        .from('personal_facturas')
        .update({ estado: 'COBRADA', fecha_cobro: cobrarFecha, cuenta_cobro_id: cobrarCuentaId })
        .eq('id', cobrarFact.id)
        .select('*')
        .single()
      if (error) throw error

      // 2. Registrar ingreso en finanzas personales vía cruzadas
      const res = await fetch('/api/operaciones/cruzadas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo:        'INGRESO_COMITENTE',
          fecha:       cobrarFecha,
          monto:       cobrarFact.monto,
          moneda:      cobrarFact.moneda,
          descripcion: `Cobro factura ${cobrarFact.numero} — ${cobrarFact.cliente_nombre}`,
          cuenta_id:   cobrarCuentaId,
          categoria_id: ID_HONORARIOS,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Error al registrar ingreso')

      setFacturas(prev => prev.map(f => f.id === cobrarFact.id ? data : f))
      toast.success('Factura marcada como cobrada · ingreso registrado')
      setCobrarFact(null)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar cobro')
    } finally {
      setLoading(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Facturas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comprobantes tipo C — Monotributista</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => window.open(ARCA_URL, '_blank')}
          >
            <ExternalLink className="h-4 w-4" /> Ir a ARCA
          </Button>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNewDialog}>
            <Plus className="h-4 w-4" /> Nueva factura
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Emitido este mes',    value: fmtARS(metrics.emitidoMes), color: 'text-foreground' },
          { label: 'Cobrado este mes',    value: fmtARS(metrics.cobradoMes), color: 'text-emerald-400' },
          { label: 'Pendientes de cobro', value: String(metrics.pendientes), color: metrics.pendientes > 0 ? 'text-amber-400' : 'text-foreground' },
          { label: 'Total acumulado año', value: fmtARS(metrics.totalAnio),  color: 'text-blue-400' },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-card border border-border p-4">
            <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-1">{m.label}</p>
            <p className={`text-lg font-semibold tabular-nums ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-hidden">
        {facturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card">
            <p className="text-sm text-muted-foreground">Sin facturas registradas</p>
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNewDialog}>
              <Plus className="h-4 w-4" /> Nueva factura
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                  <th className="text-left px-4 py-3">Número</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Concepto</th>
                  <th className="text-right px-4 py-3">Monto</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Cobro</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{f.numero}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {fmtDate(f.fecha_emision)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-foreground truncate max-w-[140px]">{f.cliente_nombre}</p>
                      {f.cliente_cuit && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono">{f.cliente_cuit}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{f.concepto}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-foreground">{fmtMonto(f.monto, f.moneda)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ESTADO_BADGE[f.estado] ?? ''}`}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground tabular-nums">
                      {fmtDate(f.fecha_cobro)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        {f.estado === 'EMITIDA' && (
                          <button
                            onClick={() => openCobrar(f)}
                            className="p-1.5 text-muted-foreground hover:text-emerald-400 transition-colors"
                            title="Marcar cobrada"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditDialog(f)}
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                          disabled={f.estado === 'ANULADA'}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {f.estado !== 'ANULADA' && f.estado !== 'COBRADA' && (
                          <button
                            onClick={() => anularFactura(f.id)}
                            disabled={loading === 'anular-' + f.id}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30"
                            title="Anular"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <a
                          href={f.arca_link ?? ARCA_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-muted-foreground hover:text-blue-400 transition-colors"
                          title="Abrir ARCA"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dialog: nueva / editar factura ───────────────────────────────────── */}
      <Dialog open={openNew} onOpenChange={v => { if (!v) setOpenNew(false) }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editFact ? 'Editar factura' : 'Nueva factura'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); saveFactura() }} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="N° comprobante *"
                value={form.numero}
                onChange={e => set('numero', e.target.value)}
                placeholder="0001-00000001"
                required
              />
              <FormInput
                label="Fecha emisión *"
                type="date"
                value={form.fecha_emision}
                onChange={e => set('fecha_emision', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Cliente — nombre *"
                value={form.cliente_nombre}
                onChange={e => set('cliente_nombre', e.target.value)}
                placeholder="Nombre o razón social"
                required
              />
              <FormInput
                label="CUIT (opcional)"
                value={form.cliente_cuit}
                onChange={e => set('cliente_cuit', e.target.value)}
                placeholder="20-12345678-9"
              />
            </div>

            <FormTextarea
              label="Concepto *"
              value={form.concepto}
              onChange={e => set('concepto', e.target.value)}
              placeholder="Descripción del servicio prestado"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Monto *"
                type="number"
                min={0}
                step="0.01"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
                placeholder="0"
                required
              />
              <FormSelect
                label="Moneda"
                value={form.moneda}
                onChange={e => set('moneda', e.target.value)}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </FormSelect>
            </div>

            <FormInput
              label="Notas (opcional)"
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Información adicional"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={loading === 'save'}
              >
                {loading === 'save' ? 'Guardando…' : editFact ? 'Guardar cambios' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: marcar cobrada ────────────────────────────────────────────── */}
      <Dialog open={!!cobrarFact} onOpenChange={v => { if (!v) setCobrarFact(null) }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como cobrada</DialogTitle>
          </DialogHeader>

          {cobrarFact && (
            <div className="space-y-4 mt-2">
              <div className="rounded-md bg-muted/20 border border-border px-4 py-3 text-sm space-y-0.5">
                <p className="font-mono text-xs text-muted-foreground">{cobrarFact.numero}</p>
                <p className="text-foreground font-medium">{cobrarFact.cliente_nombre}</p>
                <p className="text-emerald-400 font-semibold tabular-nums">{fmtMonto(cobrarFact.monto, cobrarFact.moneda)}</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Fecha de cobro *</label>
                <input
                  type="date"
                  value={cobrarFecha}
                  onChange={e => setCobrarFecha(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Cuenta de acreditación *</label>
                <select
                  value={cobrarCuentaId}
                  onChange={e => setCobrarCuentaId(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                Se registrará automáticamente un ingreso en Finanzas Personales con categoría Honorarios.
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setCobrarFact(null)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={confirmarCobro}
                  disabled={loading === 'cobrar'}
                >
                  {loading === 'cobrar' ? 'Registrando…' : 'Confirmar cobro'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
