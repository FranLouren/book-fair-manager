'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Author {
    id: number | string
    name: string
}

interface AuthorBook {
    key: string
    title: string
    isbn: string
    price: number
    bookIds: number[]
    fairsCount: number
}

interface Props {
    onClose: () => void
    onUpdated?: () => void
}

export default function ManageAuthorsModal({ onClose, onUpdated }: Props) {
    const [authors, setAuthors] = useState<Author[]>([])
    const [booksCountByAuthor, setBooksCountByAuthor] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    // Navigation state: selected author to view books
    const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null)
    const [authorBooks, setAuthorBooks] = useState<AuthorBook[]>([])
    const [loadingBooks, setLoadingBooks] = useState(false)
    const [authorBooksError, setAuthorBooksError] = useState<string | null>(null)
    const [authorBooksSuccess, setAuthorBooksSuccess] = useState<string | null>(null)

    // New author state
    const [showAddForm, setShowAddForm] = useState(false)
    const [newAuthorName, setNewAuthorName] = useState('')
    const [addingAuthor, setAddingAuthor] = useState(false)
    const [addError, setAddError] = useState<string | null>(null)
    const [addSuccess, setAddSuccess] = useState<string | null>(null)

    // Editing author state
    const [editingAuthorId, setEditingAuthorId] = useState<number | string | null>(null)
    const [editingAuthorName, setEditingAuthorName] = useState('')
    const [updatingAuthor, setUpdatingAuthor] = useState(false)
    const [editError, setEditError] = useState<string | null>(null)

    // Deleting author state
    const [deletingAuthor, setDeletingAuthor] = useState<Author | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)

    // New book for author state
    const [showAddBookForm, setShowAddBookForm] = useState(false)
    const [newBookTitle, setNewBookTitle] = useState('')
    const [newBookIsbn, setNewBookIsbn] = useState('')
    const [newBookPrice, setNewBookPrice] = useState('')
    const [savingNewBook, setSavingNewBook] = useState(false)
    const [addBookError, setAddBookError] = useState<string | null>(null)

    // Editing book state
    const [editingBookKey, setEditingBookKey] = useState<string | null>(null)
    const [editBookTitle, setEditBookTitle] = useState('')
    const [editBookIsbn, setEditBookIsbn] = useState('')
    const [editBookPrice, setEditBookPrice] = useState('')
    const [savingEditBook, setSavingEditBook] = useState(false)
    const [editBookError, setEditBookError] = useState<string | null>(null)

    // Deleting book state
    const [deletingBook, setDeletingBook] = useState<AuthorBook | null>(null)
    const [isDeletingBook, setIsDeletingBook] = useState(false)
    const [deleteBookError, setDeleteBookError] = useState<string | null>(null)

    // Load authors and book counts from Supabase
    async function loadAuthors() {
        setLoading(true)
        setAddError(null)

        try {
            // 1. Fetch persistent authors
            const { data: authorsData, error: authorsError } = await supabase
                .from('authors')
                .select('id, name')
                .order('name')

            if (authorsError) {
                console.error('Error fetching authors:', authorsError)
                setAddError('Error al cargar la lista de autores desde Supabase.')
                setLoading(false)
                return
            }

            const sortedAuthors = (authorsData || []).sort((a: Author, b: Author) =>
                a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
            )
            setAuthors(sortedAuthors)

            // 2. Fetch books to calculate book count per author
            const { data: booksData } = await supabase
                .from('books')
                .select('author_id, author, title, isbn')

            if (booksData) {
                // Count unique books per author
                const authorBooksMap: Record<string, Set<string>> = {}
                booksData.forEach((b: any) => {
                    const idKey = b.author_id ? String(b.author_id) : null
                    const nameKey = b.author?.trim().toLowerCase()
                    const bookKey = (b.isbn?.trim() || b.title?.trim() || '').toLowerCase()

                    if (!bookKey) return

                    if (idKey) {
                        if (!authorBooksMap[idKey]) authorBooksMap[idKey] = new Set()
                        authorBooksMap[idKey].add(bookKey)
                    }
                    if (nameKey) {
                        if (!authorBooksMap[nameKey]) authorBooksMap[nameKey] = new Set()
                        authorBooksMap[nameKey].add(bookKey)
                    }
                })

                const counts: Record<string, number> = {}
                for (const k in authorBooksMap) {
                    counts[k] = authorBooksMap[k].size
                }
                setBooksCountByAuthor(counts)
            }
        } catch (err: any) {
            console.error('Unexpected error loading authors:', err)
            setAddError('Error inesperado al cargar autores.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAuthors()
    }, [])

    // Load books for a specific author
    async function loadAuthorBooks(author: Author) {
        setLoadingBooks(true)
        setAuthorBooksError(null)

        try {
            const { data, error } = await supabase
                .from('books')
                .select('id, title, isbn, price, fair_id')
                .or(`author_id.eq.${author.id},author.ilike.${author.name.trim()}`)
                .order('title')

            if (error) {
                console.error('Error fetching author books:', error)
                setAuthorBooksError('Error al cargar los libros del autor.')
                setLoadingBooks(false)
                return
            }

            // Deduplicate books by ISBN or Title across fairs
            const map = new Map<string, AuthorBook>()
            ;(data || []).forEach((b: any) => {
                const title = b.title?.trim() || ''
                const isbn = b.isbn?.trim() || ''
                if (!title) return

                const key = (isbn || title).toLowerCase()
                if (map.has(key)) {
                    const existing = map.get(key)!
                    existing.bookIds.push(b.id)
                    existing.fairsCount += 1
                } else {
                    map.set(key, {
                        key,
                        title,
                        isbn,
                        price: Number(b.price) || 0,
                        bookIds: [b.id],
                        fairsCount: b.fair_id ? 1 : 0,
                    })
                }
            })

            const booksList = Array.from(map.values()).sort((a, b) =>
                a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
            )
            setAuthorBooks(booksList)
        } catch (err: any) {
            console.error('Unexpected error loading author books:', err)
            setAuthorBooksError('Error inesperado al cargar libros.')
        } finally {
            setLoadingBooks(false)
        }
    }

    // Enter into an author's books view
    function handleSelectAuthor(author: Author) {
        setSelectedAuthor(author)
        setShowAddBookForm(false)
        setEditingBookKey(null)
        setDeletingBook(null)
        loadAuthorBooks(author)
    }

    // Return to authors list
    function handleBackToAuthors() {
        setSelectedAuthor(null)
        setAuthorBooks([])
        setShowAddBookForm(false)
        setEditingBookKey(null)
        setDeletingBook(null)
        setAuthorBooksError(null)
        setAuthorBooksSuccess(null)
        loadAuthors()
    }

    // Add new author
    async function handleAddAuthor(e?: React.FormEvent) {
        if (e) e.preventDefault()
        const trimmed = newAuthorName.trim()
        if (!trimmed) {
            setAddError('Introduce el nombre del autor o autora.')
            return
        }

        const duplicate = authors.find(
            a => a.name.toLowerCase() === trimmed.toLowerCase()
        )
        if (duplicate) {
            setAddError(`El autor "${duplicate.name}" ya existe en la lista.`)
            return
        }

        setAddingAuthor(true)
        setAddError(null)
        setAddSuccess(null)

        const { error } = await supabase
            .from('authors')
            .insert({ name: trimmed })
            .select('id, name')
            .single()

        if (error) {
            console.error('Error creating author:', error)
            setAddError(error.message || 'Error al guardar el autor en Supabase.')
            setAddingAuthor(false)
            return
        }

        setNewAuthorName('')
        setShowAddForm(false)
        setAddSuccess(`Autor "${trimmed}" añadido correctamente.`)
        setTimeout(() => setAddSuccess(null), 3000)
        setAddingAuthor(false)

        await loadAuthors()
        if (onUpdated) onUpdated()
    }

    // Inline edit author
    function startEdit(author: Author) {
        setEditingAuthorId(author.id)
        setEditingAuthorName(author.name)
        setEditError(null)
    }

    function cancelEdit() {
        setEditingAuthorId(null)
        setEditingAuthorName('')
        setEditError(null)
    }

    async function handleSaveEdit(authorId: number | string) {
        const trimmed = editingAuthorName.trim()
        if (!trimmed) {
            setEditError('El nombre no puede estar vacío.')
            return
        }

        const duplicate = authors.find(
            a => a.id !== authorId && a.name.toLowerCase() === trimmed.toLowerCase()
        )
        if (duplicate) {
            setEditError(`Ya existe otro autor con el nombre "${duplicate.name}".`)
            return
        }

        setUpdatingAuthor(true)
        setEditError(null)

        const oldAuthor = authors.find(a => a.id === authorId)
        const oldName = oldAuthor?.name

        const { error: updateError } = await supabase
            .from('authors')
            .update({ name: trimmed })
            .eq('id', authorId)

        if (updateError) {
            console.error('Error updating author:', updateError)
            setEditError(updateError.message || 'Error al actualizar el autor.')
            setUpdatingAuthor(false)
            return
        }

        if (oldName) {
            await supabase
                .from('books')
                .update({ author: trimmed })
                .or(`author_id.eq.${authorId},author.eq.${oldName}`)
        }

        setEditingAuthorId(null)
        setEditingAuthorName('')
        setUpdatingAuthor(false)

        await loadAuthors()
        if (onUpdated) onUpdated()
    }

    // Delete author
    async function handleConfirmDelete() {
        if (!deletingAuthor) return
        setIsDeleting(true)
        setDeleteError(null)

        const { error } = await supabase
            .from('authors')
            .delete()
            .eq('id', deletingAuthor.id)

        if (error) {
            console.error('Error deleting author:', error)
            setDeleteError(
                error.message || 'Error al eliminar el autor. Puede que tenga registros vinculados.'
            )
            setIsDeleting(false)
            return
        }

        setIsDeleting(false)
        setDeletingAuthor(null)

        await loadAuthors()
        if (onUpdated) onUpdated()
    }

    // Add a new book for selected author
    async function handleAddBookToAuthor(e: React.FormEvent) {
        e.preventDefault()
        if (!selectedAuthor) return

        const title = newBookTitle.trim()
        const isbn = newBookIsbn.trim()
        const price = parseFloat(newBookPrice)

        if (!title) {
            setAddBookError('Introduce el título del libro.')
            return
        }
        if (!isbn) {
            setAddBookError('Introduce el ISBN.')
            return
        }
        if (isNaN(price) || price <= 0) {
            setAddBookError('Introduce un precio válido.')
            return
        }

        const key = (isbn || title).toLowerCase()
        if (authorBooks.some(b => b.key === key)) {
            setAddBookError('Este libro ya existe para este autor.')
            return
        }

        setSavingNewBook(true)
        setAddBookError(null)

        try {
            const insertPayload = {
                title,
                author: selectedAuthor.name,
                author_id: selectedAuthor.id,
                isbn,
                price,
                stock: 0,
            }

            // Attempt insert with fair_id: null first
            const { error: nullError } = await supabase
                .from('books')
                .insert({ ...insertPayload, fair_id: null })

            if (nullError) {
                // If fair_id has a NOT NULL constraint, associate with the latest fair
                const { data: latestFair } = await supabase
                    .from('fairs')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (latestFair) {
                    const { error: fairErr } = await supabase
                        .from('books')
                        .insert({ ...insertPayload, fair_id: latestFair.id })

                    if (fairErr) {
                        console.error('Error adding book to author:', fairErr)
                        setAddBookError(fairErr.message || 'Error al guardar el libro.')
                        setSavingNewBook(false)
                        return
                    }
                } else {
                    setAddBookError('Error al guardar el libro: ' + nullError.message)
                    setSavingNewBook(false)
                    return
                }
            }

            setNewBookTitle('')
            setNewBookIsbn('')
            setNewBookPrice('')
            setShowAddBookForm(false)
            setAuthorBooksSuccess(`"${title}" añadido al catálogo del autor.`)
            setTimeout(() => setAuthorBooksSuccess(null), 3000)

            await loadAuthorBooks(selectedAuthor)
            await loadAuthors()
            if (onUpdated) onUpdated()
        } catch (err: any) {
            console.error('Unexpected error adding book:', err)
            setAddBookError(err.message || 'Error inesperado al guardar el libro.')
        } finally {
            setSavingNewBook(false)
        }
    }

    // Start inline editing a book
    function startEditBook(book: AuthorBook) {
        setEditingBookKey(book.key)
        setEditBookTitle(book.title)
        setEditBookIsbn(book.isbn)
        setEditBookPrice(String(book.price))
        setEditBookError(null)
    }

    function cancelEditBook() {
        setEditingBookKey(null)
        setEditBookTitle('')
        setEditBookIsbn('')
        setEditBookPrice('')
        setEditBookError(null)
    }

    // Save edited book across fairs
    async function handleSaveEditBook(book: AuthorBook) {
        if (!selectedAuthor) return

        const title = editBookTitle.trim()
        const isbn = editBookIsbn.trim()
        const price = parseFloat(editBookPrice)

        if (!title) {
            setEditBookError('El título no puede estar vacío.')
            return
        }
        if (!isbn) {
            setEditBookError('El ISBN no puede estar vacío.')
            return
        }
        if (isNaN(price) || price <= 0) {
            setEditBookError('Introduce un precio válido.')
            return
        }

        setSavingEditBook(true)
        setEditBookError(null)

        try {
            const { error } = await supabase
                .from('books')
                .update({
                    title,
                    isbn,
                    price,
                    author: selectedAuthor.name,
                    author_id: selectedAuthor.id,
                })
                .in('id', book.bookIds)

            if (error) {
                console.error('Error updating book:', error)
                setEditBookError(error.message || 'Error al actualizar el libro.')
                setSavingEditBook(false)
                return
            }

            setEditingBookKey(null)
            setAuthorBooksSuccess(`"${title}" actualizado correctamente.`)
            setTimeout(() => setAuthorBooksSuccess(null), 3000)

            await loadAuthorBooks(selectedAuthor)
            if (onUpdated) onUpdated()
        } catch (err: any) {
            console.error('Unexpected error updating book:', err)
            setEditBookError(err.message || 'Error inesperado al actualizar.')
        } finally {
            setSavingEditBook(false)
        }
    }

    // Delete a book for an author
    async function handleConfirmDeleteBook() {
        if (!deletingBook || !selectedAuthor) return
        setIsDeletingBook(true)
        setDeleteBookError(null)

        try {
            const { error } = await supabase
                .from('books')
                .delete()
                .in('id', deletingBook.bookIds)

            if (error) {
                console.error('Error deleting book:', error)
                if (error.code === '23503') {
                    setDeleteBookError('No se puede eliminar porque este libro tiene ventas registradas en alguna feria.')
                } else {
                    setDeleteBookError(error.message || 'Error al eliminar el libro.')
                }
                setIsDeletingBook(false)
                return
            }

            const deletedTitle = deletingBook.title
            setDeletingBook(null)
            setIsDeletingBook(false)
            setAuthorBooksSuccess(`"${deletedTitle}" eliminado del catálogo.`)
            setTimeout(() => setAuthorBooksSuccess(null), 3000)

            await loadAuthorBooks(selectedAuthor)
            await loadAuthors()
            if (onUpdated) onUpdated()
        } catch (err: any) {
            console.error('Unexpected error deleting book:', err)
            setDeleteBookError(err.message || 'Error inesperado al eliminar.')
            setIsDeletingBook(false)
        }
    }

    // Filter authors by search query
    const filteredAuthors = authors.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-sans">
            <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 text-slate-900 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                            <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <div>
                            {selectedAuthor ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleBackToAuthors}
                                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                                        title="Volver al listado de autores"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                        </svg>
                                        <span>Autores</span>
                                    </button>
                                    <span className="text-slate-300">/</span>
                                    <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight truncate max-w-xs sm:max-w-sm">
                                        {selectedAuthor.name}
                                    </h3>
                                </div>
                            ) : (
                                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                    Gestión Autores / Libros
                                </h3>
                            )}
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {selectedAuthor
                                    ? 'Libros vinculados al autor disponibles para añadir a cualquier feria'
                                    : 'Catálogo permanente de autores y sus libros'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        title="Cerrar ventana"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* VISTA 1: LISTADO DE AUTORES */}
                {!selectedAuthor && (
                    <>
                        {/* Search Bar & Action Toolbar */}
                        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 shrink-0">
                            <div className="flex items-center justify-between gap-3">
                                <div className="relative flex-1">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar autor por nombre..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(prev => !prev)
                                        setAddError(null)
                                        if (!showAddForm && searchQuery.trim()) {
                                            setNewAuthorName(searchQuery.trim())
                                        }
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 shrink-0 cursor-pointer"
                                >
                                    <svg className="w-4 h-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d={showAddForm ? "M6 18L18 6M6 6l12 12" : "M12 4.5v15m7.5-7.5h-15"} />
                                    </svg>
                                    <span>{showAddForm ? 'Cerrar' : 'Añadir Autor'}</span>
                                </button>
                            </div>

                            {/* Formulario desplegable para nuevo autor */}
                            {showAddForm && (
                                <form onSubmit={handleAddAuthor} className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch gap-2.5">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={newAuthorName}
                                            onChange={e => {
                                                setNewAuthorName(e.target.value)
                                                if (addError) setAddError(null)
                                            }}
                                            autoFocus
                                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                                        />
                                        {newAuthorName && (
                                            <button
                                                type="button"
                                                onClick={() => setNewAuthorName('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAddForm(false)
                                                setNewAuthorName('')
                                                setAddError(null)
                                            }}
                                            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={addingAuthor || !newAuthorName.trim()}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                                        >
                                            {addingAuthor ? 'Guardando...' : 'Guardar'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {addError && (
                                <div className="mt-2.5 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
                                    {addError}
                                </div>
                            )}
                            {addSuccess && (
                                <div className="mt-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    <span>{addSuccess}</span>
                                </div>
                            )}
                        </div>

                        {/* Total Counter Sub-bar */}
                        <div className="px-6 py-2 border-b border-slate-100 bg-white flex items-center justify-between text-xs font-bold text-slate-500 shrink-0">
                            <span>Lista de autores</span>
                            <span>
                                {filteredAuthors.length} de {authors.length} {authors.length === 1 ? 'autor' : 'autores'}
                            </span>
                        </div>

                        {/* Lista de autores */}
                        <div className="flex-1 overflow-y-auto px-6 py-2.5">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 font-medium">
                                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700 mb-3"></div>
                                    <span className="text-sm">Cargando catálogo...</span>
                                </div>
                            ) : filteredAuthors.length === 0 ? (
                                <div className="py-14 text-center">
                                    <p className="text-base font-bold text-slate-800">
                                        {searchQuery ? 'No se encontraron autores con esa búsqueda' : 'No hay autores registrados'}
                                    </p>
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewAuthorName(searchQuery.trim())
                                                setShowAddForm(true)
                                            }}
                                            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                            </svg>
                                            <span>Crear &quot;{searchQuery}&quot; como nuevo autor</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredAuthors.map(author => {
                                        const isEditing = editingAuthorId === author.id
                                        const count = booksCountByAuthor[String(author.id)] || booksCountByAuthor[author.name.toLowerCase()] || 0

                                        return (
                                            <div
                                                key={author.id}
                                                className="py-3 px-3 flex items-center justify-between gap-4 group transition hover:bg-slate-50/90 rounded-xl"
                                            >
                                                {isEditing ? (
                                                    <div className="flex-1 flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingAuthorName}
                                                                onChange={e => setEditingAuthorName(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveEdit(author.id)
                                                                    if (e.key === 'Escape') cancelEdit()
                                                                }}
                                                                className="h-8.5 flex-1 rounded-lg border border-slate-400 bg-white px-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-800"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveEdit(author.id)}
                                                                disabled={updatingAuthor}
                                                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 shrink-0"
                                                            >
                                                                {updatingAuthor ? 'Guardando...' : 'Guardar'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={cancelEdit}
                                                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                        {editError && (
                                                            <span className="text-[11px] font-semibold text-red-600">
                                                                {editError}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Left: Avatar + Author Info + Actions right next to the Author */}
                                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-black text-xs border border-slate-200">
                                                                {author.name.charAt(0).toUpperCase()}
                                                            </div>

                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span
                                                                        onClick={() => handleSelectAuthor(author)}
                                                                        className="text-sm font-bold text-slate-900 truncate hover:text-slate-700 cursor-pointer"
                                                                        title={`Ver libros de ${author.name}`}
                                                                    >
                                                                        {author.name}
                                                                    </span>

                                                                    {/* Botones de gestión del autor pegados al nombre */}
                                                                    <div className="inline-flex items-center gap-0.5 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                startEdit(author)
                                                                            }}
                                                                            className="rounded-md p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition cursor-pointer"
                                                                            title="Editar autor"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setDeletingAuthor(author)
                                                                                setDeleteError(null)
                                                                            }}
                                                                            className="rounded-md p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                                            title="Eliminar autor"
                                                                        >
                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <span className="text-[11px] font-medium text-slate-500">
                                                                    {count > 0
                                                                        ? `${count} ${count === 1 ? 'libro en catálogo' : 'libros en catálogo'}`
                                                                        : 'Sin libros asignados'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Right: Botón Ver libros situado a la derecha */}
                                                        <div className="shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectAuthor(author)}
                                                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 transition cursor-pointer shadow-2xs group-hover:border-slate-300"
                                                                title={`Ver y gestionar libros de ${author.name}`}
                                                            >
                                                                <span>Ver libros</span>
                                                                <svg className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* VISTA 2: LIBROS DEL AUTOR SELECCIONADO */}
                {selectedAuthor && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Sub-header con botón añadir libro y volver */}
                        <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-200 shrink-0 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={handleBackToAuthors}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                            >
                                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                                <span>Volver a autores</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddBookForm(prev => !prev)
                                    setAddBookError(null)
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
                            >
                                <svg className="w-4 h-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={showAddBookForm ? "M6 18L18 6M6 6l12 12" : "M12 4.5v15m7.5-7.5h-15"} />
                                </svg>
                                <span>{showAddBookForm ? 'Cerrar' : 'Añadir Libro'}</span>
                            </button>
                        </div>

                        {/* Mensajes de feedback */}
                        {authorBooksSuccess && (
                            <div className="mx-6 mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-1.5 shrink-0">
                                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>{authorBooksSuccess}</span>
                            </div>
                        )}
                        {authorBooksError && (
                            <div className="mx-6 mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 shrink-0">
                                {authorBooksError}
                            </div>
                        )}

                        {/* Formulario desplegable para añadir libro al autor */}
                        {showAddBookForm && (
                            <div className="mx-6 mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50 shrink-0">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                                    Nuevo libro para {selectedAuthor.name}
                                </h4>
                                <form onSubmit={handleAddBookToAuthor} className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 mb-1 block">Título *</label>
                                            <input
                                                type="text"
                                                value={newBookTitle}
                                                onChange={e => setNewBookTitle(e.target.value)}
                                                autoFocus
                                                className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 mb-1 block">ISBN *</label>
                                            <input
                                                type="text"
                                                value={newBookIsbn}
                                                onChange={e => setNewBookIsbn(e.target.value)}
                                                className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-800 font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="max-w-xs">
                                        <label className="text-[11px] font-bold text-slate-700 mb-1 block">Precio (€) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={newBookPrice}
                                            onChange={e => setNewBookPrice(e.target.value)}
                                            className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-800"
                                        />
                                    </div>

                                    {addBookError && (
                                        <div className="text-xs text-red-600 font-semibold">{addBookError}</div>
                                    )}

                                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddBookForm(false)}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={savingNewBook}
                                            className="rounded-lg bg-slate-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                                        >
                                            {savingNewBook ? 'Guardando...' : 'Guardar Libro'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Listado de libros del autor */}
                        <div className="flex-1 overflow-y-auto px-6 py-3">
                            {loadingBooks ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 font-medium">
                                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700 mb-3"></div>
                                    <span className="text-sm">Cargando libros del autor...</span>
                                </div>
                            ) : authorBooks.length === 0 ? (
                                <div className="py-14 text-center">
                                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                        </svg>
                                    </div>
                                    <p className="text-base font-bold text-slate-800">
                                        No hay libros registrados para {selectedAuthor.name}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Pulsa en &quot;Añadir Libro&quot; arriba para registrar su primera obra en el catálogo.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {authorBooks.map(book => {
                                        const isEditing = editingBookKey === book.key

                                        return (
                                            <div
                                                key={book.key}
                                                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 rounded-xl transition hover:bg-slate-50/80"
                                            >
                                                {isEditing ? (
                                                    <div className="flex-1 space-y-2">
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            <div className="sm:col-span-1">
                                                                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Título</label>
                                                                <input
                                                                    type="text"
                                                                    value={editBookTitle}
                                                                    onChange={e => setEditBookTitle(e.target.value)}
                                                                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">ISBN</label>
                                                                <input
                                                                    type="text"
                                                                    value={editBookIsbn}
                                                                    onChange={e => setEditBookIsbn(e.target.value)}
                                                                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono text-slate-900 outline-none focus:border-slate-800"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Precio (€)</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={editBookPrice}
                                                                    onChange={e => setEditBookPrice(e.target.value)}
                                                                    className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-slate-800"
                                                                />
                                                            </div>
                                                        </div>
                                                        {editBookError && (
                                                            <p className="text-xs text-red-600 font-semibold">{editBookError}</p>
                                                        )}
                                                        <div className="flex justify-end gap-2 pt-1">
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditBook}
                                                                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveEditBook(book)}
                                                                disabled={savingEditBook}
                                                                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                                                            >
                                                                {savingEditBook ? 'Guardando...' : 'Guardar'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Left: Book details */}
                                                        <div className="min-w-0 flex-1">
                                                            <h5 className="font-bold text-slate-900 text-sm truncate">
                                                                {book.title}
                                                            </h5>
                                                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                                ISBN: {book.isbn || 'Sin ISBN'}
                                                            </p>
                                                        </div>

                                                        {/* Right: Price & actions */}
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <span className="font-extrabold text-slate-900 text-sm font-mono">
                                                                {book.price.toFixed(2)} €
                                                            </span>

                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEditBook(book)}
                                                                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition cursor-pointer"
                                                                    title="Editar libro"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setDeletingBook(book)
                                                                        setDeleteBookError(null)
                                                                    }}
                                                                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                                    title="Eliminar libro"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Bar */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-white shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                        {selectedAuthor
                            ? `${authorBooks.length} ${authorBooks.length === 1 ? 'libro registrado' : 'libros registrados'}`
                            : `${authors.length} ${authors.length === 1 ? 'autor en total' : 'autores en total'}`}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-slate-700 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            {/* Sub-Modal de confirmación para eliminar autor */}
            {deletingAuthor && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 border border-red-200">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-900">¿Eliminar autor?</h4>
                                <p className="text-xs text-slate-500">Esta acción retirará al autor de la lista global.</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-700 mb-2">
                            Estás a punto de eliminar a <strong>{deletingAuthor.name}</strong>.
                        </p>

                        {(booksCountByAuthor[String(deletingAuthor.id)] || booksCountByAuthor[deletingAuthor.name.toLowerCase()] || 0) > 0 && (
                            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-medium">
                                <strong>Nota:</strong> Este autor tiene libros registrados. Los libros existentes conservarán su nombre en el historial de ventas.
                            </div>
                        )}

                        {deleteError && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                                {deleteError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeletingAuthor(null)
                                    setDeleteError(null)
                                }}
                                disabled={isDeleting}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                            >
                                {isDeleting ? 'Eliminando...' : 'Sí, eliminar autor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Modal de confirmación para eliminar libro del autor */}
            {deletingBook && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-900">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 border border-red-200">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-900">¿Eliminar libro?</h4>
                                <p className="text-xs text-slate-500">Se retirará del catálogo de este autor.</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-700 mb-2">
                            Estás a punto de eliminar <strong>&quot;{deletingBook.title}&quot;</strong> ({deletingBook.isbn}).
                        </p>

                        {deleteBookError && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                                {deleteBookError}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeletingBook(null)
                                    setDeleteBookError(null)
                                }}
                                disabled={isDeletingBook}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteBook}
                                disabled={isDeletingBook}
                                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
                            >
                                {isDeletingBook ? 'Eliminando...' : 'Sí, eliminar libro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
