'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'

export default function LoginPage() {
    // Form state management
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    useEffect(() => {
        document.title = BRAND.title
        async function checkAlreadyLoggedIn() {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                router.replace('/dashboard')
            }
        }
        checkAlreadyLoggedIn()
    }, [router])

    // Handle user authentication via Supabase
    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        setLoading(true)
        setError('')

        // Authenticate user credentials
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError('Correo electrónico o contraseña incorrectos')
            setLoading(false)
            return
        }

        // Redirect to dashboard on successful login
        router.push('/dashboard')
    }

    return (
        <main className={`flex min-h-screen items-center justify-center bg-slate-50 bg-gradient-to-br ${BRAND.theme.loginGradient} p-4`}>
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 border border-slate-200/80">
                {/* Header branding with logo */}
                <div className="flex flex-col items-center text-center mb-8">
                    {BRAND.showLogo ? (
                        <img
                            src={BRAND.logo}
                            alt={`${BRAND.name} Logo`}
                            className="h-20 w-20 rounded-full object-cover border-2 border-indigo-500/20 shadow-md mb-4"
                        />
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                    )}
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{BRAND.name}</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">{BRAND.subtitle}</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                    {/* Email Input */}
                    <div>
                        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                            Correo Electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
                        />
                    </div>

                    {/* Error Feedback */}
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50"
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </button>
                </form>
            </div>
        </main>
    )
}
