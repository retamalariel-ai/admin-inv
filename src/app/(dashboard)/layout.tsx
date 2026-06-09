import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar    from '@/components/layout/Sidebar'
import FXRatesBar from '@/components/layout/FXRatesBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar userEmail={user.email} />

      <div className="ml-60 flex flex-col min-h-screen">
        {/* Top bar — sticky, blurry, ultra-sutil */}
        <header className="
          sticky top-0 z-10
          flex items-center justify-between
          h-12 px-8
          bg-background/80 backdrop-blur-md
          border-b border-border
        ">
          <div />
          <FXRatesBar />
        </header>

        <main className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
