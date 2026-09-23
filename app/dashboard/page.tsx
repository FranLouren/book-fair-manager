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
        <div className="min-h-screen bg-[#f3f4f6] text-slate-900 font-sans">

            {/* Header navbar */}
            <header className="border-b border-slate-200 bg-[#fafafa] px-6 py-6 shadow-xs">
                <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
                    <img
                        src="/logo.jpg"
                        alt="Masticadores León Logo"
                        className="h-16 w-16 rounded-full object-cover border-2 border-slate-300 shadow-sm"
                    />
                    <div className="text-center sm:text-left">
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">Masticadores León</h1>
                        <p className="text-sm font-semibold text-slate-500 mt-0.5">Gestión de Ferias del Libro</p>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                
                {/* Hero Header Banner */}
                <div className="mb-8 rounded-2xl border border-slate-200 bg-[#fafafa] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ferias de Libros</h2>
                            {!loading && (
                                <span className="rounded-full bg-slate-200/80 border border-slate-300 px-3 py-0.5 text-xs font-bold text-slate-700">
                                    {fairs.length} {fairs.length === 1 ? 'feria' : 'ferias'}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                            Administra tus ferias activas, catálogo de inventario y registros de ventas.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] shrink-0">
                        <span className="text-lg leading-none">+</span> Nueva Feria
                    </button>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 mb-4"></div>
                        <p className="text-slate-600 font-bold">Cargando ferias...</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && fairs.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-[#fafafa] p-16 text-center shadow-xs">
                        <p className="text-xl font-bold text-slate-900">No hay ferias registradas</p>
                        <p className="mt-1 text-sm font-medium text-slate-500 max-w-md mx-auto">
                            Crea tu primera feria para empezar a añadir libros, gestionar stock y registrar ventas.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
                            + Crear Primera Feria
                        </button>
                    </div>
                )}

                {/* Fairs list grid */}
                {!loading && fairs.length > 0 && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {fairs.map(fair => (
                            <div
                                key={fair.id}
                                onClick={() => router.push(`/dashboard/${fair.id}/books`)}
                                className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-[#fafafa] shadow-xs transition-all duration-200 hover:border-slate-400 hover:shadow-md flex flex-col justify-between overflow-hidden">
                                
                                {/* Top Accent Bar */}
                                <div className="h-1.5 w-full bg-slate-300 group-hover:bg-slate-600 transition-colors"></div>

                                <div className="p-6">
                                    {/* Card Header: Title & Actions */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-slate-700 transition-colors leading-snug">
                                            {fair.name}
                                        </h3>

                                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setEditingFair(fair)}
                                                className="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition"
                                                title="Editar feria"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeleteError(null)
                                                    setDeletingFair(fair)
                                                }}
                                                className="rounded-lg p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100/70 transition"
                                                title="Eliminar feria"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>

                                    {/* Badges Info Section */}
                                    <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200/60">
                                        {fair.location && (
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200/70 text-xs">📍</span>
                                                <span>{fair.location}</span>
                                            </div>
                                        )}
                                        
                                        {fair.start_date && (
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200/70 text-xs">📅</span>
                                                <span>{fair.start_date} {fair.end_date ? ` al ${fair.end_date}` : ''}</span>
                                            </div>
                                        )}

                                        {fair.discount_percentage !== undefined && (
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-xs">🏷️</span>
                                                <span>{fair.discount_percentage}% Descuento aplicado</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#fafafa] p-6 shadow-xl border border-slate-200 text-slate-900">
                        <h3 className="text-lg font-bold text-slate-900">¿Eliminar feria?</h3>
                        <p className="mt-2 text-sm font-medium text-slate-600">
                            ¿Estás seguro de que deseas eliminar <strong className="text-slate-900">&quot;{deletingFair.name}&quot;</strong>? Se eliminarán también todos los libros pertenecientes a esta feria.
                        </p>
                        {deleteError && (
                            <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                                {deleteError}
                            </div>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setDeletingFair(null)
                                    setDeleteError(null)
                                }}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteFair}
                                disabled={deleting}
                                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50"
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
