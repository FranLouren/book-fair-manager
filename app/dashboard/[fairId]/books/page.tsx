'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Type definition for a Book record
type Book = {
    id: number
    fair_id: number
    title: string
    author: string | null
    price: number
    stock: number
    created_at: string
}

export default function BooksPage() {
    const params = useParams()
    const router = useRouter()
    const fairId = params.fairId

    // State management
    const [fairName, setFairName] = useState('')
    const [books, setBooks] = useState<Book[]>([])
    const [loading, setLoading] = useState(true)

    // Fetch fair details and books from Supabase database
    async function loadData() {
        if (!fairId) return

        setLoading(true)

        // Query 'fairs' table to get the fair name for this ID
        const { data: fairData } = await supabase
            .from('fairs')
            .select('name')
            .eq('id', fairId)
            .single()

        if (fairData) {
            setFairName(fairData.name)
        }

        // Query 'books' table to get the books for this fair
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

    // Load data on component mount or when fairId changes
    useEffect(() => {
        loadData()
    }, [fairId])

    return (
        <div className="min-h-screen bg-[#0f172a]">
            {/* Header navbar */}
            <header className="border-b border-[#1e293b] bg-[#0f172a] px-8 py-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            {fairName ? fairName : `Feria #${fairId}`}
                        </h1>
                        <p className="text-sm text-[#94a3b8]">Gestión del catálogo de libros</p>
                    </div>
                    {/* Back to dashboard button */}
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="rounded-lg border border-[#334155] px-4 py-2 text-sm font-semibold text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                    >
                        ← Volver a Ferias
                    </button>
                </div>
            </header>
            {/* Main content area */}
            <main className="p-8">
                {/* Section header with action button */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Catálogo de Libros</h2>
                    <button className="rounded-lg bg-[#6366f1] px-5 py-2.5 font-semibold text-white transition hover:bg-[#4f46e5]">
                        + Añadir Libro
                    </button>
                </div>
                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <p className="text-[#94a3b8]">Cargando catálogo de libros...</p>
                    </div>
                )}
                {/* Empty state */}
                {!loading && books.length === 0 && (
                    <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-16 text-center">
                        <p className="text-4xl"></p>
                        <p className="mt-4 text-lg font-medium text-white">No hay libros registrados en esta feria</p>
                        <p className="mt-2 text-sm text-[#94a3b8]">
                            Añade tu primer libro para empezar a gestionar el stock y las ventas.
                        </p>
                    </div>
                )}
                {/* Books list grid */}
                {!loading && books.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {books.map(book => (
                            <div
                                key={book.id}
                                className="rounded-2xl border border-[#334155] bg-[#1e293b] p-6 transition hover:border-[#6366f1]"
                            >
                                <h3 className="text-lg font-bold text-white">{book.title}</h3>
                                {book.author && (
                                    <p className="mt-1 text-sm text-[#94a3b8]">✍️ {book.author}</p>
                                )}
                                <div className="mt-4 flex items-center justify-between border-t border-[#334155] pt-4">
                                    <span className="text-lg font-semibold text-[#6366f1]">{book.price} €</span>
                                    <span className="rounded-md bg-[#0f172a] px-3 py-1 text-xs font-medium text-white">
                                        Stock: {book.stock}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

