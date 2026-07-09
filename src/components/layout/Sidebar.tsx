'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Bitcoin,
  FileText,
  Upload,
  DollarSign,
  Settings,
  LogOut,
  Wallet,
  Landmark,
  ArrowLeftRight,
  CreditCard,
  PieChart,
  RefreshCcw,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import NavItem from './NavItem'

const NAV_ITEMS = [
  { href: '/',                          icon: LayoutDashboard, label: 'Dashboard'       },
  { href: '/clientes',                  icon: Users,           label: 'Clientes'        },
  { href: '/transacciones',             icon: FileText,        label: 'Transacciones'   },
  { href: '/transacciones/importar',        icon: Upload,          label: 'Importar boletos', indent: true },
  { href: '/transacciones/importar-crypto', icon: Bitcoin,         label: 'Importar Crypto',  indent: true },
  { href: '/capital-markets',               icon: TrendingUp,      label: 'Capital Markets' },
  { href: '/crypto',                    icon: Bitcoin,         label: 'Crypto'          },
  { href: '/comisiones',                         icon: DollarSign,      label: 'Comisiones'          },
  { href: '/finanzas-personales',                icon: Wallet,          label: 'Finanzas Personales' },
  { href: '/finanzas-personales/cuentas',        icon: Landmark,        label: 'Cuentas',        indent: true },
  { href: '/finanzas-personales/transacciones',  icon: ArrowLeftRight,  label: 'Transacciones',  indent: true },
  { href: '/finanzas-personales/tarjetas',       icon: CreditCard,      label: 'Tarjetas',       indent: true },
  { href: '/finanzas-personales/presupuesto',    icon: PieChart,        label: 'Presupuesto',    indent: true },
  { href: '/finanzas-personales/suscripciones',  icon: RefreshCcw,      label: 'Suscripciones',  indent: true },
  { href: '/finanzas-personales/patrimonio',     icon: BarChart3,       label: 'Patrimonio',     indent: true },
  { href: '/config',                             icon: Settings,        label: 'Configuración'   },
]

interface SidebarProps {
  userEmail: string | undefined
}

export default function Sidebar({ userEmail }: SidebarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Error al cerrar sesión')
      return
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="
      fixed inset-y-0 left-0 w-60 flex flex-col
      bg-sidebar border-r border-sidebar-border
    ">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-sidebar-border flex items-center gap-2.5">
        <Image
          src="/logo-cfo.jpg"
          alt="CFO Tech Partners"
          width={36}
          height={36}
          className="rounded-full shrink-0"
        />
        <span className="text-[13px] font-semibold tracking-wide text-primary leading-tight">
          CFO Inversiones
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} indent={item.indent} />
        ))}
      </nav>

      {/* Usuario + Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {userEmail && (
          <p className="text-[11px] text-sidebar-foreground/40 truncate px-3 mb-2 font-mono">
            {userEmail}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="
            flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm
            text-sidebar-foreground/50
            hover:text-destructive hover:bg-destructive/10
            transition-colors duration-150
          "
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
