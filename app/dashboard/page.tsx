'use client'

import { useEffect, useState } from "react"
import { supabase } from '@/lib/supabase'
import NewFairModal from '@/components/NewFairModal'
import EditFairModal from '@/components/EditFairModal'
import ManageAuthorsModal from '@/components/ManageAuthorsModal'
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
    const [showAuthorsModal, setShowAuthorsModal] = useState(false)
    const [editingFair, setEditingFair] = useState<Fair | null>(null)
    const [deletingFair, setDeletingFair] = useState<Fair | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // Status toggle & tab filter state
    const [fairTabFilter, setFairTabFilter] = useState<'active' | 'finalized' | 'all'>('active')
    const [finalizingFair, setFinalizingFair] = useState<Fair | null>(null)
    const [loadingStatusId, setLoadingStatusId] = useState<number | null>(null)
    const [loggingOut, setLoggingOut] = useState(false)

    // Router for navigation
    const router = useRouter()

    // Sign out handler with loading animation
    async function handleLogout() {
        if (loggingOut) return
        setLoggingOut(true)
        try {
            await supabase.auth.signOut()
        } catch (err) {
            console.error('Error signing out:', err)
        } finally {
            router.replace('/login')
        }
    }

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
        <div className="min-h-screen bg-[#eaedf1] text-slate-900 font-sans">

            {/* Header navbar - Option 2: Clean White with true elevation & contrast */}
            <header className="border-t-[3px] border-t-slate-900 border-b border-slate-300 bg-white px-6 py-5 shadow-md sticky top-0 z-30">
                <div className="mx-auto max-w-7xl relative flex items-center justify-center min-h-[64px]">
                    {/* Centered Logo & Title */}
                    <div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center cursor-pointer"
                        onClick={() => router.push('/dashboard')}
                    >
                        <img
                            src="/logo.jpg"
                            alt="Masticadores León Logo"
                            className="h-16 w-16 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                        />
                        <div className="text-center sm:text-left">
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">Masticadores León</h1>
                            <p className="text-sm font-semibold text-slate-500 mt-0.5">Gestión de Ferias del Libro</p>
                        </div>
                    </div>

                    {/* Logout button positioned on the right */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold transition shadow-xs group ${
                                loggingOut
                                    ? 'opacity-75 cursor-not-allowed text-slate-500 bg-slate-50'
                                    : 'text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer'
                            }`}
                            title="Cerrar sesión"
                        >
                            {loggingOut ? (
                                <svg className="w-4 h-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-slate-500 group-hover:text-red-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                </svg>
                            )}
                            <span className="hidden sm:inline">
                                {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

                {/* Premium Control Center Card: Title, Action & Tabs unified */}
                <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
                    {/* Top row: Icon + Title & Description on Left, Action Button on Right */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            {/* Graphic Book / Fair Icon Badge - Refined light slate background */}
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs">
                                <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                                    Ferias de Libros
                                </h2>
                                <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500">
                                    Gestión de catálogos, control de inventario y registro de ventas.
                                </p>
                            </div>
                        </div>

                        {/* Action buttons: Gestionar Autores + Nueva Feria */}
                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <button
                                onClick={() => setShowAuthorsModal(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:border-slate-400 active:scale-[0.98] cursor-pointer"
                                title="Administrar catálogo de autores"
                            >
                                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                <span>Gestionar Autores</span>
                            </button>

                            <button
                                onClick={() => setShowModal(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 hover:shadow-sm active:scale-[0.98] cursor-pointer"
                            >
                                <svg className="w-4 h-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span>Nueva Feria</span>
                            </button>
                        </div>
                    </div>

                    {/* Integrated Filter Tabs */}
                    {!loading && (
                        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                            {/* Tab 1: Ferias Activas */}
                            <button
                                type="button"
                                onClick={() => setFairTabFilter('active')}
                                className={`flex items-center gap-2.5 px-4.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${fairTabFilter === 'active'
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                                    }`}
                            >
                                {/* Glowing Status Dot Indicator */}
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>Ferias Activas</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${fairTabFilter === 'active'
                                        ? 'bg-slate-800 text-emerald-300'
                                        : 'bg-white text-slate-600 border border-slate-200/80'
                                    }`}>
                                    {activeFairs.length}
                                </span>
                            </button>

                            {/* Tab 2: Ferias Finalizadas */}
                            <button
                                type="button"
                                onClick={() => setFairTabFilter('finalized')}
                                className={`flex items-center gap-2.5 px-4.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${fairTabFilter === 'finalized'
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                                    }`}
                            >
                                {/* Clean Archive SVG Icon */}
                                <svg
                                    className={`w-3.5 h-3.5 transition-colors ${fairTabFilter === 'finalized' ? 'text-amber-300' : 'text-amber-600'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                                <span>Ferias Finalizadas</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${fairTabFilter === 'finalized'
                                        ? 'bg-slate-800 text-amber-300'
                                        : 'bg-white text-slate-600 border border-slate-200/80'
                                    }`}>
                                    {finalizedFairs.length}
                                </span>
                            </button>

                            {/* Tab 3: Todas */}
                            <button
                                type="button"
                                onClick={() => setFairTabFilter('all')}
                                className={`flex items-center gap-2.5 px-4.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${fairTabFilter === 'all'
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60'
                                    }`}
                            >
                                {/* Clean Catalog/Layers SVG Icon */}
                                <svg
                                    className={`w-3.5 h-3.5 transition-colors ${fairTabFilter === 'all' ? 'text-slate-200' : 'text-slate-500'}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span>Todas</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${fairTabFilter === 'all'
                                        ? 'bg-slate-800 text-slate-200'
                                        : 'bg-white text-slate-600 border border-slate-200/80'
                                    }`}>
                                    {fairs.length}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 mb-4"></div>
                        <p className="text-slate-600 font-bold">Cargando ferias...</p>
                    </div>
                )}

                {/* Empty state when no fairs match active filter */}
                {!loading && displayedFairs.length === 0 && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-xs">
                        {fairTabFilter === 'finalized' ? (
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 shadow-2xs">
                                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                            </div>
                        ) : (
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
                                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                        )}
                        <p className="text-xl font-bold text-slate-900">
                            {fairTabFilter === 'finalized'
                                ? 'No hay ferias finalizadas'
                                : fairTabFilter === 'active'
                                    ? 'No hay ferias activas actualmente'
                                    : 'No hay ferias registradas'}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-500 max-w-md mx-auto">
                            {fairTabFilter === 'finalized'
                                ? 'Las ferias que des por finalizadas aparecerán aquí para consultar su catálogo y registros.'
                                : 'Crea tu primera feria para empezar a añadir libros, gestionar stock y registrar ventas.'}
                        </p>
                        {fairTabFilter === 'active' && (
                            <button
                                onClick={() => setShowModal(true)}
                                className="mt-6 rounded-xl bg-slate-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 cursor-pointer">
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
                                    className={`group cursor-pointer rounded-2xl border bg-white shadow-xs transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${isFinalized
                                            ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400'
                                            : 'border-slate-200/90 hover:border-slate-300'
                                        }`}
                                >

                                    {/* Top Accent Bar */}
                                    <div className={`h-1.5 w-full transition-colors ${isFinalized
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
                                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 text-[11px] font-extrabold">
                                                            <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                                            </svg>
                                                            Finalizada
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-extrabold">
                                                            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                                                            Activa
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Icon Buttons */}
                                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setEditingFair(fair)}
                                                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition cursor-pointer"
                                                    title="Editar feria"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDeleteError(null)
                                                        setDeletingFair(fair)
                                                    }}
                                                    className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                    title="Eliminar feria"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Badges Info Section */}
                                        <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-200/60">
                                            {fair.location && (
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200/70 text-slate-600">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                                        </svg>
                                                    </span>
                                                    <span>{fair.location}</span>
                                                </div>
                                            )}

                                            {fair.start_date && (
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200/70 text-slate-600">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                                        </svg>
                                                    </span>
                                                    <span>{fair.start_date} {fair.end_date ? ` al ${fair.end_date}` : ''}</span>
                                                </div>
                                            )}

                                            {fair.discount_percentage !== undefined && (
                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.386a4.5 4.5 0 001.218-.988l4.318-4.318a4.5 4.5 0 00.988-1.218c.486-.827.313-1.908-.386-2.607L12.41 3.659A2.25 2.25 0 0010.82 3h-1.252z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                                                        </svg>
                                                    </span>
                                                    <span>{fair.discount_percentage}% Descuento aplicado</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Bottom Card Action Bar */}
                                        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-end" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setFinalizingFair(fair)}
                                                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer ${isFinalized
                                                        ? 'bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-800 hover:text-white'
                                                        : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-600 hover:text-white'
                                                    }`}
                                                title={isFinalized ? 'Reabrir feria' : 'Finalizar feria'}
                                            >
                                                {isFinalized ? 'Reabrir Feria' : 'Finalizar Feria'}
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
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 text-slate-900">
                        <h3 className="text-lg font-bold text-slate-900">
                            {finalizingFair.status === 'finalized' ? '¿Reabrir feria?' : '¿Finalizar feria?'}
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
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50 ${finalizingFair.status === 'finalized' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-amber-600 hover:bg-amber-700'
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
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 text-slate-900">
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

            {/* Modal for managing authors globally */}
            {showAuthorsModal && (
                <ManageAuthorsModal
                    onClose={() => setShowAuthorsModal(false)}
                />
            )}
        </div>
    )
}
