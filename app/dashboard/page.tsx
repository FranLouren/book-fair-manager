'use client'

import { useEffect, useState } from "react"
import { supabase } from '@/lib/supabase'

// Type definition for a book fair record
type Fair = {
    id: number
    name: string
    location: string | null
    start_date: string | null
    end_date: string | null
    created_at: string
}

export default function DashboardPage() {
    // State management
    const [fairs, setFairs] = useState<Fair[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch book fairs from Supabase database
    async function loadFairs() {
        const { data, error } = await supabase
            .from('fairs')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error loading fairs:', error)
            return
        }

        setFairs(data)
        setLoading(false)
    }

    // Load fairs on component mount
    useEffect(() => {
        loadFairs()
    }, [])

    return (
        <div className="min-h-screen bg-[#0f172a]">

            {/* Header navbar */}
            <header className="border-b border-[#1e293b] bg-[#0f172a] px-8 py-5">
                <div>
                    <h1 className="text-xl font-bold text-white">Masticadores León</h1>
                    <p className="text-sm text-[#94a3b8]">Gestión de Ferias del Libro</p>
                </div>
            </header>

            {/* Main content area */}
            <main className="p-8">
                {/* Section header with action button */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Ferias</h2>
                    <button className="rounded-lg bg-[#6366f1] px-5 py-2.5 font-semibold text-white transition hover:bg-[#4f46e5]">
                        + Nueva Feria
                    </button>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-[#94a3b8]">Cargando ferias...</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && fairs.length === 0 && (
                    <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-16 text-center">
                        <p className="text-4xl">📚</p>
                        <p className="mt-4 text-lg font-medium text-white">No hay ferias todavía</p>
                        <p className="mt-2 text-sm text-[#94a3b8]">
                            Crea tu primera feria para empezar a gestionar libros y ventas
                        </p>
                    </div>
                )}

                {/* Fairs list grid */}
                {!loading && fairs.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {fairs.map(fair => (
                            <div key={fair.id} className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6">
                                <h3 className="text-lg font-bold text-white">{fair.name}</h3>
                                {fair.location && (
                                    <p className="mt-1 text-sm text-[#94a3b8]">📍 {fair.location}</p>
                                )}
                                {fair.start_date && (
                                    <p className="mt-1 text-sm text-[#94a3b8]">📅 {fair.start_date}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
