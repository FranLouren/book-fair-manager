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
    status?: 'active' | 'finalized' | string
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

    // Status toggle & tab filter state
    const [fairTabFilter, setFairTabFilter] = useState<'active' | 'finalized' | 'all'>('active')
    const [finalizingFair, setFinalizingFair] = useState<Fair | null>(null)
    const [loadingStatusId, setLoadingStatusId] = useState<number | null>(null)

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

    // Toggle fair status handler (Active <-> Finalized)
    async function toggleFairStatus(fair: Fair) {
        const newStatus = fair.status === 'finalized' ? 'active' : 'finalized'
        setLoadingStatusId(fair.id)

        const { error } = await supabase
            .from('fairs')
            .update({ status: newStatus })
            .eq('id', fair.id)

        if (error) {
            console.error('Error updating fair status:', error)
            alert('Error al cambiar el estado en Supabase.\nSi la columna "status" aún no existe en la tabla "fairs", ejecuta en la consola de Supabase SQL:\nALTER TABLE fairs ADD COLUMN status TEXT DEFAULT \'active\';')
        }

        setLoadingStatusId(null)
        setFinalizingFair(null)
        loadFairs()
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

    // Filtered lists by status tab
    const activeFairs = fairs.filter(f => f.status !== 'finalized')
    const finalizedFairs = fairs.filter(f => f.status === 'finalized')
    const displayedFairs = fairTabFilter === 'active'
        ? activeFairs
        : fairTabFilter === 'finalized'
            ? finalizedFairs
            : fairs

    return (
        <div className="min-h-screen bg-[#f3f4f6] text-slate-900 font-sans">

            {/* Header navbar */}
            <header className="border-b border-slate-200 bg-[#fafafa] px-6 py-6 shadow-xs">
                <div className="mx-auto max-w-7xl relative flex items-center justify-center min-h-[64px]">
                    {/* Centered Logo & Title */}
                    <div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center cursor-pointer"
                        onClick={() => router.push('/dashboard')}
                    >
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

                    {/* Logout button positioned on the right */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut()
                                router.replace('/login')
                            }}
                            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition shadow-xs cursor-pointer"
                            title="Cerrar sesión"
                        >
                            <span>🚪</span> <span className="hidden sm:inline">Cerrar sesión</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                
                {/* Hero Header Banner */}
                <div className="mb-6 rounded-2xl border border-slate-200 bg-[#fafafa] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
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
                            Administra tus ferias activas, consulta el historial de ferias finalizadas y gestiona ventas e inventario.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] shrink-0 cursor-pointer">
                        <span className="text-lg leading-none">+</span> Nueva Feria
                    </button>
                </div>

                {/* Filter Tabs (Activas / Finalizadas / Todas) */}
                {!loading && (
                    <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3">
                        <button
                            onClick={() => setFairTabFilter('active')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                fairTabFilter === 'active'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <span>🟢 Ferias Activas</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${fairTabFilter === 'active' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                {activeFairs.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setFairTabFilter('finalized')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                fairTabFilter === 'finalized'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <span>🏁 Historial Finalizadas</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${fairTabFilter === 'finalized' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                {finalizedFairs.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setFairTabFilter('all')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                fairTabFilter === 'all'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <span>📋 Todas</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${fairTabFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800'}`}>
                                {fairs.length}
                            </span>
                        </button>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 mb-4"></div>
                        <p className="text-slate-600 font-bold">Cargando ferias...</p>
                    </div>
                )}

                {/* Empty state when no fairs match active filter */}
                {!loading && displayedFairs.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-[#fafafa] p-16 text-center shadow-xs">
                        <p className="text-3xl mb-3">{fairTabFilter === 'finalized' ? '🏁' : '📚'}</p>
                        <p className="text-xl font-bold text-slate-900">
                            {fairTabFilter === 'finalized'
                                ? 'No hay ferias finalizadas en el historial'
                                : fairTabFilter === 'active'
                                    ? 'No hay ferias activas actualmente'
                                    : 'No hay ferias registradas'}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-500 max-w-md mx-auto">
                            {fairTabFilter === 'finalized'
                                ? 'Las ferias que des por finalizadas aparecerán aquí para consultar su historial y catálogo.'
                                : 'Crea tu primera feria para empezar a añadir libros, gestionar stock y registrar ventas.'}
                        </p>
                        {fairTabFilter === 'active' && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 cursor-pointer">
                                + Crear Primera Feria
                            </button>
                        )}
                    </div>
                )}

                {/* Fairs list grid */}
                {!loading && displayedFairs.length > 0 && (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {displayedFairs.map(fair => {
                            const isFinalized = fair.status === 'finalized'
                            return (
                                <div
                                    key={fair.id}
                                    onClick={() => router.push(`/dashboard/${fair.id}/books`)}
                                    className={`group cursor-pointer rounded-2xl border bg-[#fafafa] shadow-xs transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                        isFinalized
                                            ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400'
                                            : 'border-slate-200/90 hover:border-slate-400'
                                    }`}
                                >
                                    
                                    {/* Top Accent Bar */}
                                    <div className={`h-1.5 w-full transition-colors ${
                                        isFinalized
                                            ? 'bg-amber-400 group-hover:bg-amber-500'
                                            : 'bg-emerald-500 group-hover:bg-slate-600'
                                    }`}></div>

                                    <div className="p-6">
                                        {/* Card Header: Title & Badges & Actions */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-slate-700 transition-colors leading-snug">
                                                    {fair.name}
                                                </h3>
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    {isFinalized ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold">
                                                            🏁 Finalizada (Historial)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 text-[10px] font-extrabold">
                                                            🟢 Activa
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Icon Buttons */}
                                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setEditingFair(fair)}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition cursor-pointer"
                                                    title="Editar feria"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDeleteError(null)
                                                        setDeletingFair(fair)
                                                    }}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-100/70 transition cursor-pointer"
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

                                        {/* Bottom Card Action Bar */}
                                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                                            <span className="text-[11px] font-bold text-slate-500">
                                                {isFinalized ? 'Modo consulta histórica' : 'Entrar a la feria →'}
                                            </span>

                                            <button
                                                onClick={() => setFinalizingFair(fair)}
                                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${
                                                    isFinalized
                                                        ? 'bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-800 hover:text-white'
                                                        : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-600 hover:text-white'
                                                }`}
                                                title={isFinalized ? 'Reabrir feria' : 'Finalizar feria'}
                                            >
                                                {isFinalized ? '🔄 Reabrir Feria' : '🏁 Finalizar Feria'}
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            )
                        })}
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

            {/* Modal for finalizing or reopening a fair */}
            {finalizingFair && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#fafafa] p-6 shadow-xl border border-slate-200 text-slate-900">
                        <h3 className="text-lg font-bold text-slate-900">
                            {finalizingFair.status === 'finalized' ? '🔄 ¿Reabrir feria?' : '🏁 ¿Finalizar feria?'}
                        </h3>
                        <p className="mt-2 text-sm font-medium text-slate-600">
                            {finalizingFair.status === 'finalized'
                                ? `¿Deseas reabrir "${finalizingFair.name}" para volver a habilitar el registro de ventas y modificar stock?`
                                : `¿Estás seguro de que deseas finalizar "${finalizingFair.name}"? Pasará a la pestaña de Historial de Ferias Finalizadas. Podrás seguir consultando todo su catálogo, ventas e historial en cualquier momento.`
                            }
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setFinalizingFair(null)}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => toggleFairStatus(finalizingFair)}
                                disabled={loadingStatusId === finalizingFair.id}
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 ${
                                    finalizingFair.status === 'finalized' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                            >
                                {loadingStatusId === finalizingFair.id
                                    ? 'Guardando...'
                                    : finalizingFair.status === 'finalized'
                                        ? 'Reabrir Feria'
                                        : 'Finalizar Feria'}
                            </button>
                        </div>
                    </div>
                </div>
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
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteFair}
                                disabled={deleting}
                                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50 cursor-pointer"
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
