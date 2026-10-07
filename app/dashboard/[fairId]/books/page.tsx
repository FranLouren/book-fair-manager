'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NewBookModal from '@/components/NewBookModal'
import EditBookModal from '@/components/EditBookModal'
import SellBookModal from '@/components/SellBookModal'
import HistoryModal from '@/components/HistoryModal'

// Type definition for a Book record
type Book = {
    id: number
    fair_id: number
    isbn: string
    title: string
    author: string | null
    price: number
    stock: number
    sold?: number
    created_at: string
}

export default function BooksPage() {
    const params = useParams()
    const router = useRouter()
    const rawFairId = params?.fairId
    const fairId: string = Array.isArray(rawFairId) ? rawFairId[0] : (rawFairId || '')

    // State management
    const [fairName, setFairName] = useState('')
    const [fairLocation, setFairLocation] = useState<string | null>(null)
    const [fairStartDate, setFairStartDate] = useState<string | null>(null)
    const [fairEndDate, setFairEndDate] = useState<string | null>(null)
    const [discountPercentage, setDiscountPercentage] = useState(10)
    const [books, setBooks] = useState<Book[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [sellingBook, setSellingBook] = useState<Book | null>(null)
    const [editingBook, setEditingBook] = useState<Book | null>(null)
    const [deletingBook, setDeletingBook] = useState<Book | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // Quick restock / stock adjustment modal state
    const [restockBook, setRestockBook] = useState<Book | null>(null)
    const [stockMode, setStockMode] = useState<'add' | 'remove'>('add')
    const [addedStock, setAddedStock] = useState('5')
    const [stockNotes, setStockNotes] = useState('')
    const [restocking, setRestocking] = useState(false)
    const [restockError, setRestockError] = useState<string | null>(null)

    // Set tab title and load fair details & books on mount
    useEffect(() => {
        document.title = "Feria Masticadores"
        if (fairId) {
            loadFairDetails()
            loadBooks()
        }
    }, [fairId])

    // Load fair details
    async function loadFairDetails() {
        if (!fairId) return
        const { data, error } = await supabase
            .from('fairs')
            .select('name, location, start_date, end_date, discount_percentage')
            .eq('id', fairId)
            .single()

        if (error) {
            console.error('Error loading fair details:', error)
            return
        }

        if (data) {
            setFairName(data.name)
            setFairLocation(data.location)
            setFairStartDate(data.start_date)
            setFairEndDate(data.end_date)
            setDiscountPercentage(data.discount_percentage ?? 10)
        }
    }

    // Load books for the active fair and calculate sold units dynamically from sale_items
    async function loadBooks() {
        if (!fairId) return
        setLoading(true)

        // 1. Fetch books belonging to this fair
        const { data: booksData, error: booksError } = await supabase
            .from('books')
            .select('*')
            .eq('fair_id', fairId)
            .order('created_at', { ascending: false })

        if (booksError) {
            console.error('Error loading books:', booksError)
            setLoading(false)
            return
        }

        const currentBooks = booksData || []

        if (currentBooks.length === 0) {
            setBooks([])
            setLoading(false)
            return
        }

        // 2. Fetch sales belonging to this fair to get their IDs
        const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('id')
            .eq('fair_id', fairId)

        if (salesError) {
            console.error('Error loading sales for computing sold units:', salesError)
            setBooks(currentBooks.map(b => ({ ...b, sold: 0 })))
            setLoading(false)
            return
        }

        const saleIds = (salesData || []).map(s => s.id)

        if (saleIds.length === 0) {
            setBooks(currentBooks.map(b => ({ ...b, sold: 0 })))
            setLoading(false)
            return
        }

        // 3. Fetch sale_items for these sales to sum quantities per book
        const { data: saleItemsData, error: saleItemsError } = await supabase
            .from('sale_items')
            .select('book_id, quantity')
            .in('sale_id', saleIds)

        if (saleItemsError) {
            console.error('Error loading sale items:', saleItemsError)
            setBooks(currentBooks.map(b => ({ ...b, sold: 0 })))
        } else {
            const soldMap: Record<number, number> = {}
            for (const item of saleItemsData || []) {
                soldMap[item.book_id] = (soldMap[item.book_id] || 0) + item.quantity
            }

            const booksWithSold = currentBooks.map(b => ({
                ...b,
                sold: soldMap[b.id] || 0,
            }))
            setBooks(booksWithSold)
        }

        setLoading(false)
    }

    // Delete handler for confirming book removal from Supabase
    async function confirmDeleteBook() {
        if (!deletingBook) return
        setDeleting(true)
        setDeleteError(null)

        const { data, error } = await supabase
            .from('books')
            .delete()
            .eq('id', deletingBook.id)
            .select()

        if (error) {
            console.error('Error deleting book:', error)
            setDeleteError(error.message || 'Error al eliminar el libro en Supabase')
            setDeleting(false)
            return
        }

        if (!data || data.length === 0) {
            console.error('No rows deleted. Check RLS DELETE policy on books table.')
            setDeleteError('Supabase bloqueó el borrado. Comprueba que exista la política RLS para DELETE en la tabla "books".')
            setDeleting(false)
            return
        }

        setDeleting(false)
        setDeletingBook(null)
        loadBooks()
    }

    // Quick restock / stock adjustment handler
    async function handleRestockSubmit() {
        if (!restockBook) return
        const qty = parseInt(addedStock)
        if (isNaN(qty) || qty <= 0) {
            setRestockError('Introduce una cantidad válida mayor que 0.')
            return
        }

        if (stockMode === 'remove' && qty > restockBook.stock) {
            setRestockError(`No puedes retirar más stock del existente (${restockBook.stock} unidades).`)
            return
        }

        setRestocking(true)
        setRestockError(null)

        const movementQty = stockMode === 'add' ? qty : -qty
        const newStock = restockBook.stock + movementQty

        const { error: updateError } = await supabase
            .from('books')
            .update({ stock: newStock })
            .eq('id', restockBook.id)

        if (updateError) {
            console.error('Error updating stock:', updateError)
            setRestockError('Error al actualizar el stock en Supabase.')
            setRestocking(false)
            return
        }

        const movementPayload: any = {
            fair_id: Number(fairId),
            book_id: restockBook.id,
            quantity: movementQty,
            movement_type: stockMode === 'add' ? 'restock' : 'adjustment',
            notes: stockNotes.trim() || null,
        }

        const { error: historyError } = await supabase.from('stock_movements').insert(movementPayload)

        if (historyError) {
            console.error('Error inserting stock_movement, tentando fallback con movement_type restock:', historyError)
            // Fallback 1: Keep notes, try movement_type 'restock'
            movementPayload.movement_type = 'restock'
            const { error: fallback1Err } = await supabase.from('stock_movements').insert(movementPayload)

            if (fallback1Err) {
                console.error('Error in fallback 1, tentando sin notes:', fallback1Err)
                delete movementPayload.notes
                await supabase.from('stock_movements').insert(movementPayload)
            }
        }

        setRestocking(false)
        setRestockBook(null)
        setStockNotes('')
        loadBooks()
    }

    // Filter books based on search query (Title, Author, or ISBN)
    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="min-h-screen bg-[#f3f4f6] text-slate-900 font-sans">
            {/* Global Consistent Header Navbar */}
            <header className="border-b border-slate-200 bg-[#fafafa] px-6 py-6 shadow-xs">
                <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-center gap-4 text-center cursor-pointer" onClick={() => router.push('/dashboard')}>
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
                
                {/* Page Breadcrumb & Title Header Banner */}
                <div className="mb-8 rounded-2xl border border-slate-200 bg-[#fafafa] p-6 shadow-xs">
                    {/* Breadcrumbs */}
                    <nav className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-3">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="hover:text-slate-900 hover:underline transition"
                        >
                            Ferias
                        </button>
                        <span>/</span>
                        <span className="text-slate-900">{fairName || `Feria #${fairId}`}</span>
                    </nav>

                    {/* Title & Badges */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                {fairName || `Feria #${fairId}`}
                            </h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">
                                Catálogo de inventario de libros y registro de ventas.
                            </p>

                            {/* Info Badges */}
                            <div className="mt-3.5 flex flex-wrap items-center gap-2">
                                {fairLocation && (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200/70 px-2.5 py-1 text-xs font-semibold text-slate-800 border border-slate-300/60">
                                        <span>📍</span> {fairLocation}
                                    </span>
                                )}
                                {fairStartDate && (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200/70 px-2.5 py-1 text-xs font-semibold text-slate-800 border border-slate-300/60">
                                        <span>📅</span> {fairStartDate} {fairEndDate ? ` al ${fairEndDate}` : ''}
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-900 border border-slate-300">
                                    <span>🏷️</span> {discountPercentage}% Descuento aplicado
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 mb-4"></div>
                        <p className="text-slate-600 font-bold">Cargando catálogo de libros...</p>
                    </div>
                )}

                {/* Empty state when no books exist */}
                {!loading && books.length === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-[#fafafa] p-16 text-center shadow-xs">
                        <p className="text-4xl mb-4">📚</p>
                        <p className="text-xl font-bold text-slate-900">No hay libros registrados en esta feria</p>
                        <p className="mt-1 text-sm font-medium text-slate-500 max-w-md mx-auto">
                            Añade tu primer libro para empezar a gestionar el stock y registrar ventas.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800"
                        >
                            + Añadir Libro
                        </button>
                    </div>
                )}

                {/* Card Container with Integrated Toolbar and Table */}
                {!loading && books.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#fafafa] shadow-xs">
                        {/* Integrated Table Header Toolbar */}
                        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                            {/* Search Input with Icon */}
                            <div className="relative w-full sm:w-80">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                    <svg
                                        className="h-4 w-4 text-slate-400"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por título, autor o ISBN..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowHistory(true)}
                                    className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-200/80 whitespace-nowrap shadow-xs"
                                >
                                    📜 Historial
                                </button>
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 whitespace-nowrap shadow-xs"
                                >
                                    + Añadir Libro
                                </button>
                            </div>
                        </div>

                        {/* Table Content */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-900">
                                <thead className="border-b border-slate-200 bg-slate-100/80 text-xs font-bold uppercase tracking-wider text-slate-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-[16%]">ISBN</th>
                                        <th className="px-6 py-4 text-left w-[24%]">Título</th>
                                        <th className="px-6 py-4 text-left w-[18%]">Autor</th>
                                        <th className="px-6 py-4 text-left w-[10%]">Precio</th>
                                        <th className="px-6 py-4 text-left w-[12%] text-emerald-700">Precio Feria (-{discountPercentage}%)</th>
                                        <th className="px-6 py-4 text-center w-[6%]">Stock</th>
                                        <th className="px-6 py-4 text-center w-[6%]">Vendidos</th>
                                        <th className="px-6 py-4 text-right w-[8%]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200/80">
                                    {filteredBooks.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                No se encontraron libros que coincidan con &quot;{searchQuery}&quot;
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredBooks.map(book => (
                                            <tr key={book.id} className="transition hover:bg-slate-100/60">
                                                <td className="px-6 py-4 text-slate-600 font-mono text-xs text-left font-semibold">{book.isbn || '-'}</td>
                                                <td className="px-6 py-4 font-bold text-slate-900 text-left">{book.title}</td>
                                                <td className="px-6 py-4 text-slate-700 font-medium text-left">{book.author || '-'}</td>
                                                <td className="px-6 py-4 font-medium text-slate-600 text-left">{book.price} €</td>
                                                <td className="px-6 py-4 font-extrabold text-emerald-700 text-left">
                                                    {((book.price * (100 - discountPercentage)) / 100).toFixed(2)} €
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 shrink-0 flex justify-center">
                                                            <span
                                                                className={`inline-flex items-center justify-center w-full rounded-md px-2 py-1 text-sm font-mono transition ${
                                                                    book.stock === 0
                                                                        ? 'bg-rose-100 text-rose-700 font-extrabold border border-rose-300'
                                                                        : 'bg-slate-200/80 text-slate-900 font-extrabold'
                                                                }`}
                                                            >
                                                                {book.stock}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => {
                                                                    setRestockError(null)
                                                                    setAddedStock('5')
                                                                    setStockMode('add')
                                                                    setRestockBook(book)
                                                                }}
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white transition hover:bg-slate-800 shrink-0 shadow-2xs"
                                                                title="Añadir stock rápido"
                                                            >
                                                                +
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setRestockError(null)
                                                                    setAddedStock('1')
                                                                    setStockMode('remove')
                                                                    setRestockBook(book)
                                                                }}
                                                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-rose-100 text-rose-700 border border-rose-300 text-sm font-bold transition hover:bg-rose-600 hover:text-white shrink-0 shadow-2xs"
                                                                title="Retirar stock"
                                                            >
                                                                -
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-extrabold text-emerald-700 text-center">
                                                    {book.sold || 0}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setSellingBook(book)}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/80 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-300 transition hover:bg-emerald-600 hover:text-white"
                                                            title="Vender libro"
                                                        >
                                                            🛒 Vender
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingBook(book)}
                                                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                                                            title="Editar libro"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingBook(book)}
                                                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-100 hover:text-red-600"
                                                            title="Eliminar libro"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal for adding a new book */}
            {showModal && fairId && (
                <NewBookModal
                    fairId={fairId}
                    onClose={() => setShowModal(false)}
                    onCreated={loadBooks}
                />
            )}

            {/* Modal for history and audit */}
            {showHistory && (
                <HistoryModal
                    fairId={fairId}
                    fairName={fairName}
                    books={books}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {/* Modal for selling a book */}
            {sellingBook && (
                <SellBookModal
                    book={sellingBook}
                    discountPercentage={discountPercentage}
                    onClose={() => setSellingBook(null)}
                    onSold={loadBooks}
                />
            )}

            {/* Modal for editing a book */}
            {editingBook && (
                <EditBookModal
                    book={editingBook}
                    onClose={() => setEditingBook(null)}
                    onUpdated={loadBooks}
                />
            )}

            {/* Confirmation dialog for deleting a book */}
            {deletingBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#fafafa] p-6 shadow-xl border border-slate-200 text-slate-900">
                        <h3 className="text-lg font-bold text-slate-900">¿Eliminar libro?</h3>
                        <p className="mt-2 text-sm text-slate-600 font-medium">
                            ¿Estás seguro de que deseas eliminar <strong className="text-slate-900">&quot;{deletingBook.title}&quot;</strong>? Esta acción no se puede deshacer.
                        </p>
                        {deleteError && (
                            <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                                {deleteError}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeletingBook(null)}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteBook}
                                disabled={deleting}
                                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Restock / Stock Adjustment Mini-modal */}
            {restockBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#fafafa] p-6 shadow-xl border border-slate-200 text-slate-900">
                        <h3 className="text-lg font-bold text-slate-900">
                            {stockMode === 'add' ? 'Añadir Stock' : 'Retirar Stock'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 font-medium">
                            {stockMode === 'add' ? 'Añadir' : 'Retirar'} unidades de <strong className="text-slate-900">&quot;{restockBook.title}&quot;</strong> (Stock actual: {restockBook.stock})
                        </p>

                        {restockError && (
                            <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                                {restockError}
                            </div>
                        )}

                        {/* Quick preset buttons */}
                        <div className="mt-4 flex gap-2">
                            {(stockMode === 'add' ? ['1', '5', '10', '20'] : ['1', '2', '5', '10']).map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setAddedStock(val)}
                                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                                        addedStock === val
                                            ? stockMode === 'add'
                                                ? 'border-slate-900 bg-slate-900 text-white'
                                                : 'border-rose-700 bg-rose-700 text-white'
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    {stockMode === 'add' ? `+${val}` : `-${val}`}
                                </button>
                            ))}
                        </div>

                        {/* Custom Quantity input */}
                        <div className="mt-4">
                            <label className="mb-1.5 block text-sm font-bold text-slate-800">
                                {stockMode === 'add' ? 'Cantidad a sumar' : 'Cantidad a restar'}
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={stockMode === 'remove' ? restockBook.stock : undefined}
                                value={addedStock}
                                onChange={e => setAddedStock(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>

                        {/* Optional Notes input */}
                        <div className="mt-4">
                            <label className="mb-1.5 block text-sm font-bold text-slate-800">
                                Comentario (opcional)
                            </label>
                            <input
                                type="text"
                                placeholder={stockMode === 'remove' ? "Ej. Ejemplar dañado, devolución..." : "Ej. Reposición semanal..."}
                                value={stockNotes}
                                onChange={e => setStockNotes(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setRestockBook(null)
                                    setRestockError(null)
                                    setStockNotes('')
                                }}
                                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRestockSubmit}
                                disabled={restocking}
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-xs transition disabled:opacity-50 ${
                                    stockMode === 'add'
                                        ? 'bg-slate-900 hover:bg-slate-800'
                                        : 'bg-rose-700 hover:bg-rose-800'
                                }`}
                            >
                                {restocking
                                    ? 'Guardando...'
                                    : stockMode === 'add'
                                        ? `Añadir +${addedStock || 0}`
                                        : `Retirar -${addedStock || 0}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
