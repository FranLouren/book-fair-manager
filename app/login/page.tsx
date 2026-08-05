'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
    // Form state management
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const router = useRouter()

    // Handle user authentication via Supabase
    async function handleLogin(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        setLoading(true)
        setError('')

        // Authenticate user credentials
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError('Invalid email or password')
            setLoading(false)
            return
        }

        // Redirect to dashboard on successful login
        router.push('/dashboard')
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#0f172a]">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-xl">
                {/* Header branding */}
                <h1 className="mb-2 text-2xl font-bold text-white">Book Fair Manager</h1>
                <p className="mb-8 text-sm text-[#94a3b8]">Sign in to your account</p>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    {/* Email Input */}
                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />

                    {/* Password Input */}
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />

                    {/* Error Feedback */}
                    {error && (
                        <p className="text-sm text-red-400">{error}</p>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 rounded-lg bg-[#6366f1] py-3 font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </main>
    )
}
