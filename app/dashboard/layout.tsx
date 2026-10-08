'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null)
    const router = useRouter()

    useEffect(() => {
        // 1. Verify active Supabase token session on mount
        async function checkAuth() {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setAuthenticated(false)
                router.replace('/login')
            } else {
                setAuthenticated(true)
            }
        }

        checkAuth()

        // 2. Listen to real-time auth events (token refresh, logout, session expiration)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                setAuthenticated(false)
                router.replace('/login')
            } else if (session) {
                setAuthenticated(true)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [router])

    // Show clean loading spinner while validating token session
    if (authenticated === null) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6] text-slate-900 font-sans">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 mb-4"></div>
                <p className="text-sm font-bold text-slate-600">Verificando sesión y token de acceso...</p>
            </div>
        )
    }

    if (!authenticated) {
        return null
    }

    return <>{children}</>
}
