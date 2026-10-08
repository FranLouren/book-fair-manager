'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuthAndRedirect() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }
    checkAuthAndRedirect()
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f3f4f6] text-slate-900 font-sans">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 mb-4"></div>
      <p className="text-sm font-bold text-slate-600">Cargando Masticadores León...</p>
    </main>
  )
}