'use client'

import { useEffect, useState } from "react"
import { supabase } from '@/lib/supabase'
import NewFairModal from '@/components/NewFairModal'
import EditFairModal from '@/components/EditFairModal'
import { useRouter } from 'next/navigation'

// Type definition for a book fair record
type Fair = {
    id: number
    name: string
    location: string | null
    start_date: string | null
    end_date: string | null
    discount_percentage?: number
    created_at: string
}

export default function DashboardPage() {
    // State management
    const [fairs, setFairs] = useState<Fair[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingFair, setEditingFair] = useState<Fair | null>(null)
    const [deletingFair, setDeletingFair] = useState<Fair | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // Router for navigation
    const router = useRouter()

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

        setFairs(data || [])
        setLoading(false)
    }

    // Delete handler for confirming fair removal from Supabase
    async function confirmDeleteFair() {
        if (!deletingFair) return
        setDeleting(true)
        setDeleteError(null)

        // 1. Delete associated books first to prevent foreign key constraint conflicts
        const { error: booksError } = await supabase
            .from('books')
            .delete()
            .eq('fair_id', deletingFair.id)

        if (booksError) {
            console.error('Error deleting books for fair:', booksError)
        }

        // 2. Delete the fair record
        const { data, error } = await supabase
            .from('fairs')
            .delete()
            .eq('id', deletingFair.id)
            .select()

        if (error) {
            console.error('Error deleting fair:', error)
            setDeleteError(error.message || 'Error al eliminar la feria en Supabase')
            setDeleting(false)
            return
        }

        if (!data || data.length === 0) {
            console.error('No rows deleted. Check RLS DELETE policy on fairs table.')
            setDeleteError('Supabase bloqueó el borrado. Comprueba que exista la política RLS para DELETE en la tabla "fairs".')
            setDeleting(false)
            return
        }

        setDeleting(false)
        setDeletingFair(null)
        loadFairs()
    }

    // Set tab title and load fairs on component mount
    useEffect(() => {
        document.title = "Feria Masticadores"
        loadFairs()
    }, [])

    return (
        <div className="min-h-screen bg-[#0f172a]">

            {/* Header navbar */}
            <header className="border-b border-[#1e293b] bg-[#0f172a] px-8 py-5">
                <div className="flex items-center gap-4">
                    {/* Masticadores León Logo */}
                    <img
                        src="/logo.jpg"
                        alt="Masticadores León Logo"
                        className="h-12 w-12 rounded-full object-cover border-2 border-[#6366f1]/40 shadow-lg"
                    />
                    <div>
                        <h1 className="text-xl font-extrabold text-white tracking-wide">Masticadores León</h1>
                        <p className="text-sm text-[#94a3b8]">Gestión de Ferias del Libro</p>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="p-8">
                {/* Section header with action button */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Ferias</h2>
                    <button
                        onClick={() => setShowModal(true)}
                        className="rounded-lg bg-[#6366f1] px-5 py-2.5 font-semibold text-white transition hover:bg-[#4f46e5]">
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
                            <div
                                key={fair.id}
                                onClick={() => router.push(`/dashboard/${fair.id}/books`)}
                                className="group relative cursor-pointer rounded-2xl border border-[#334155] bg-[#1e293b] p-6 transition hover:border-[#6366f1]">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-lg font-bold text-white">{fair.name}</h3>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingFair(fair)
                                            }}
                                            className="rounded-lg p-1 text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                                            title="Editar feria"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setDeleteError(null)
                                                setDeletingFair(fair)
                                            }}
                                            className="rounded-lg p-1 text-[#94a3b8] transition hover:bg-red-500/20 hover:text-red-400"
                                            title="Eliminar feria"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
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

            {/* Modal for creating a new fair */}
            {showModal && (
                <NewFairModal
                    onClose={() => setShowModal(false)}
                    onCreated={loadFairs}
                />
            )}

            {/* Modal for editing a fair */}
            {editingFair && (
                <EditFairModal
                    fair={editingFair}
                    onClose={() => setEditingFair(null)}
                    onUpdated={loadFairs}
                />
            )}

            {/* Confirmation dialog for deleting a fair */}
            {deletingFair && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#1e293b] p-6 shadow-2xl border border-[#334155]">
                        <h3 className="text-lg font-bold text-white">¿Eliminar feria?</h3>
                        <p className="mt-2 text-sm text-[#94a3b8]">
                            ¿Estás seguro de que deseas eliminar <strong className="text-white">&quot;{deletingFair.name}&quot;</strong>? Se eliminarán también todos los libros pertenecientes a esta feria.
                        </p>
                        {deleteError && (
                            <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                                {deleteError}
                            </div>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setDeletingFair(null)
                                    setDeleteError(null)
                                }}
                                className="rounded-lg border border-[#334155] px-4 py-2 text-sm font-semibold text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteFair}
                                disabled={deleting}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                            >
                                {deleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

