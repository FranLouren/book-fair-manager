'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    // Form state management
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    useEffect(() => {
        document.title = "Feria Masticadores"
    }, [])

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
        <main className="flex min-h-screen items-center justify-center bg-slate-50 bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 border border-slate-200/80">
                {/* Header branding with logo */}
                <div className="flex flex-col items-center text-center mb-8">
                    <img
                        src="/logo.jpg"
                        alt="Masticadores León Logo"
                        className="h-20 w-20 rounded-full object-cover border-2 border-indigo-500/20 shadow-md mb-4"
                    />
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Masticadores León</h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">Gestión de Ferias del Libro</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                    {/* Email Input */}
                    <div>
                        <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                            Correo electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="tu-email@ejemplo.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
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
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
                        />
                    </div>

                    {/* Error Feedback */}
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium flex items-center gap-2">
                            <span>⚠️</span>
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
