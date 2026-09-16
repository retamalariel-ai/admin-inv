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
      className={[
        'flex items-center gap-2.5 text-[12px] font-medium tracking-wide',
        'transition-colors duration-100',
        'border-l-2 pl-[10px]',
        indent
          ? 'ml-3 py-1.5 pr-3 rounded-sm'
          : 'py-2 pr-3 rounded-sm',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-primary'
          : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent/60 border-transparent',
      ].join(' ')}
    >
      <Icon
        className={[
          'shrink-0',
          indent ? 'h-3 w-3' : 'h-3.5 w-3.5',
          isActive ? 'opacity-100' : 'opacity-50',
        ].join(' ')}
      />
      {label}
    </Link>
  )
}
