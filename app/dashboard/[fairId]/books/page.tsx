'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NewBookModal from '@/components/NewBookModal'
import EditBookModal from '@/components/EditBookModal'

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
    const fairId = params.fairId

    // State management
    const [fairName, setFairName] = useState('')
    const [discountPercentage, setDiscountPercentage] = useState(10)
    const [books, setBooks] = useState<Book[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingBook, setEditingBook] = useState<Book | null>(null)
    const [deletingBook, setDeletingBook] = useState<Book | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // Delete handler for confirming book removal from Supabase
    async function confirmDeleteBook() {
        if (!deletingBook) return
        setDeleting(true)
        setDeleteError(null)

        const { error } = await supabase
            .from('books')
            .delete()
            .eq('id', deletingBook.id)

        if (error) {
            console.error('Error deleting book:', error)
            setDeleteError(error.message || 'Error al eliminar el libro en Supabase')
            setDeleting(false)
            return
        }

        setDeleting(false)
        setDeletingBook(null)
        loadData()
    }

    // Fetch fair details and books from Supabase database
    async function loadData() {
        if (!fairId) return

        setLoading(true)

        // 1. Query 'fairs' table to get the fair name and discount percentage for this ID
        const { data: fairData } = await supabase
            .from('fairs')
            .select('name, discount_percentage')
            .eq('id', fairId)
            .single()

        if (fairData) {
            setFairName(fairData.name)
            if (fairData.discount_percentage !== undefined && fairData.discount_percentage !== null) {
                setDiscountPercentage(Number(fairData.discount_percentage))
            }
        }

        // 2. Query 'books' table to get the books for this fair
        const { data: booksData, error } = await supabase
            .from('books')
            .select('*')
            .eq('fair_id', fairId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error loading books:', error)
        } else {
            setBooks(booksData || [])
        }

        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [fairId])

    // Filter books based on search query (Title, Author, or ISBN)
    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.isbn && book.isbn.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="min-h-screen bg-[#0f172a]">
            {/* Header navbar */}
            <header className="border-b border-[#1e293b] bg-[#0f172a] px-8 py-4">
                <div className="grid grid-cols-3 items-center">
                    {/* Left: Back button */}
                    <div className="flex items-center justify-start">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#334155] px-3.5 py-1.5 text-sm font-semibold text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                        >
                            ← Volver a Ferias
                        </button>
                    </div>

                    {/* Center: Fair Title */}
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white">
                            {fairName ? fairName : `Feria #${fairId}`}
                        </h1>
                        <p className="mt-1 text-sm text-[#94a3b8]">Gestión del catálogo de libros</p>
                    </div>

                    {/* Right: Empty spacer for grid balance */}
                    <div className="flex justify-end" />
                </div>
            </header>

            {/* Main content area */}
            <main className="p-8">
                {/* Section title */}
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">Catálogo de Libros</h2>
                    <p className="text-xs text-[#94a3b8] mt-1">
                        {books.length === 1 ? '1 libro en total' : `${books.length} libros en total`}
                    </p>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-[#94a3b8]">Cargando catálogo de libros...</p>
                    </div>
                )}

                {/* Empty state when no books exist */}
                {!loading && books.length === 0 && (
                    <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-16 text-center">
                        <p className="text-4xl">📚</p>
                        <p className="mt-4 text-lg font-medium text-white">No hay libros registrados en esta feria</p>
                        <p className="mt-2 text-sm text-[#94a3b8]">
                            Añade tu primer libro para empezar a gestionar el stock y las ventas.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="mt-6 rounded-lg bg-[#6366f1] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4f46e5]"
                        >
                            + Añadir Libro
                        </button>
                    </div>
                )}

                {/* Card Container with Integrated Toolbar and Table */}
                {!loading && books.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-[#334155] bg-[#1e293b]">
                        {/* Integrated Table Header Toolbar */}
                        <div className="flex flex-col gap-4 border-b border-[#334155] bg-[#0f172a]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                            {/* Search Input with Icon */}
                            <div className="relative w-full sm:w-80">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                    <svg
                                        className="h-4 w-4 text-[#94a3b8]"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por título, autor o ISBN..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full rounded-lg bg-[#1e293b] pl-10 pr-4 py-2 text-sm text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1] transition"
                                />
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={() => setShowModal(true)}
                                className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4f46e5] whitespace-nowrap shadow-sm"
                            >
                                + Añadir Libro
                            </button>
                        </div>

                        {/* Table Content */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="border-b border-[#334155] bg-[#0f172a] text-xs uppercase tracking-wider text-[#94a3b8]">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-left w-[16%]">ISBN</th>
                                        <th className="px-6 py-4 font-semibold text-left w-[24%]">Título</th>
                                        <th className="px-6 py-4 font-semibold text-left w-[18%]">Autor</th>
                                        <th className="px-6 py-4 font-semibold text-left w-[10%]">Precio</th>
                                        <th className="px-6 py-4 font-semibold text-left w-[12%] text-emerald-400">Precio Feria (-{discountPercentage}%)</th>
                                        <th className="px-6 py-4 font-semibold text-center w-[6%]">Stock</th>
                                        <th className="px-6 py-4 font-semibold text-center w-[6%]">Vendidos</th>
                                        <th className="px-6 py-4 font-semibold text-right w-[8%]">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#334155]">
                                    {filteredBooks.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-[#94a3b8]">
                                                No se encontraron libros que coincidan con &quot;{searchQuery}&quot;
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredBooks.map(book => (
                                            <tr key={book.id} className="transition hover:bg-[#0f172a]/50">
                                                <td className="px-6 py-4 text-[#94a3b8] font-mono text-xs text-left">{book.isbn || '-'}</td>
                                                <td className="px-6 py-4 font-semibold text-left">{book.title}</td>
                                                <td className="px-6 py-4 text-[#94a3b8] text-left">{book.author || '-'}</td>
                                                <td className="px-6 py-4 font-medium text-[#94a3b8] text-left">{book.price} €</td>
                                                <td className="px-6 py-4 font-bold text-emerald-400 text-left">
                                                    {((book.price * (100 - discountPercentage)) / 100).toFixed(2)} €
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-block rounded-md bg-[#0f172a] px-2.5 py-1 text-xs font-medium text-white">
                                                        {book.stock}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-emerald-400 text-center">
                                                    {book.sold || 0}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingBook(book)}
                                                            className="rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                                                            title="Editar libro"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingBook(book)}
                                                            className="rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-red-500/20 hover:text-red-400"
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
                    fairId={Array.isArray(fairId) ? fairId[0] : fairId}
                    onClose={() => setShowModal(false)}
                    onCreated={loadData}
                />
            )}

            {/* Modal for editing a book */}
            {editingBook && (
                <EditBookModal
                    book={editingBook}
                    onClose={() => setEditingBook(null)}
                    onUpdated={loadData}
                />
            )}

            {/* Confirmation dialog for deleting a book */}
            {deletingBook && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#1e293b] p-6 shadow-2xl border border-[#334155]">
                        <h3 className="text-lg font-bold text-white">¿Eliminar libro?</h3>
                        <p className="mt-2 text-sm text-[#94a3b8]">
                            ¿Estás seguro de que deseas eliminar <strong className="text-white">&quot;{deletingBook.title}&quot;</strong>? Esta acción no se puede deshacer.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setDeletingBook(null)}
                                className="rounded-lg border border-[#334155] px-4 py-2 text-sm font-semibold text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteBook}
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
