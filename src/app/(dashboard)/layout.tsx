import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/Topbar'
import ModuleTabs from '@/components/ModuleTabs'
import { ToastProvider } from '@/components/Toast'
import InstallPrompt from '@/components/InstallPrompt'
import NotificationTrigger from '@/components/NotificationTrigger'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('user_id', user.id).single()

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <Topbar profile={profile} />
      <ModuleTabs />
      <main className="min-h-screen">
        <ToastProvider>{children}</ToastProvider>
        <InstallPrompt />
        <NotificationTrigger />
      </main>
    </div>
  )
}
