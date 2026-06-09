'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  href:    string
  icon:    LucideIcon
  label:   string
  indent?: boolean
}

export default function NavItem({ href, icon: Icon, label, indent }: NavItemProps) {
  const pathname = usePathname()
  const isActive = href === '/' ? pathname === '/' : pathname === href

  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 rounded-md text-[13px] font-medium
        transition-colors duration-150
        ${indent ? 'ml-4 py-2 px-3' : 'px-3 py-2.5'}
        ${isActive
          ? `
              bg-primary/10 text-primary
              border-l-2 border-primary pl-[10px]
            `
          : `
              text-sidebar-foreground/55
              hover:text-sidebar-foreground hover:bg-sidebar-accent
              border-l-2 border-transparent pl-[10px]
            `
        }
      `}
    >
      <Icon className={`shrink-0 ${indent ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${isActive ? 'opacity-90' : 'opacity-60'}`} />
      {label}
    </Link>
  )
}
