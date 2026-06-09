'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileUp, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ParsedTransaction {
  custodian_name:   string | null
  transaction_type: string | null
  trade_date:       string | null
  settlement_date:  string | null
  ticker:           string | null
  asset_name:       string | null
  asset_type_hint:  string | null
  quantity:         number | null
  price_per_unit:   number | null
  gross_amount:     number | null
  alyce_commission: number
  other_fees:       number
  net_amount:       number | null
  currency:         string
  comitente:        string | null
  operation_number: string | null
  notes:            string | null
}

interface PDFUploaderProps {
  onParsed: (data: ParsedTransaction) => void
  className?: string
}

type State = 'idle' | 'loading' | 'success' | 'error'

export default function PDFUploader({ onParsed, className }: PDFUploaderProps) {
  const [state, setState]     = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setState('loading')
    setErrorMsg('')

    const fd = new FormData()
    fd.append('pdf', file)

    try {
      const res  = await fetch('/api/transactions/parse-pdf', { method: 'POST', body: fd })
      const json = await res.json() as { data?: ParsedTransaction; error?: string }

      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      setState('success')
      onParsed(json.data!)
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
    }
  }, [onParsed])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept:   { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: state === 'loading',
    onDropAccepted: ([file]) => processFile(file),
    onDropRejected: () => {
      setState('error')
      setErrorMsg('Solo se aceptan archivos PDF')
    },
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2',
        'rounded-lg border-2 border-dashed px-6 py-5 text-center',
        'cursor-pointer transition-colors duration-150',
        isDragActive
          ? 'border-emerald-500 bg-emerald-950/20'
          : state === 'success'
          ? 'border-emerald-700 bg-emerald-950/10'
          : state === 'error'
          ? 'border-red-700 bg-red-950/10'
          : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/60',
        state === 'loading' && 'pointer-events-none opacity-70',
        className,
      )}
    >
      <input {...getInputProps()} />

      {state === 'loading' && (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-400">Procesando {fileName}…</p>
        </>
      )}

      {state === 'success' && (
        <>
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          <p className="text-sm text-emerald-300">Datos extraídos de <span className="font-mono">{fileName}</span></p>
          <p className="text-xs text-slate-500">Soltá otro PDF para reemplazar</p>
        </>
      )}

      {state === 'error' && (
        <>
          <AlertCircle className="h-6 w-6 text-red-400" />
          <p className="text-sm text-red-300">{errorMsg}</p>
          <p className="text-xs text-slate-500">Hacé click o soltá un PDF para reintentar</p>
        </>
      )}

      {state === 'idle' && (
        <>
          <FileUp className="h-6 w-6 text-slate-500" />
          <p className="text-sm text-slate-400">
            {isDragActive ? 'Soltá el PDF aquí' : 'Arrastrá un boleto PDF o hacé click para seleccionar'}
          </p>
          <p className="text-xs text-slate-600">Solo archivos .pdf</p>
        </>
      )}
    </div>
  )
}
