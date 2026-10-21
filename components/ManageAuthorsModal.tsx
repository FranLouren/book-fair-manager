'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Author {
    id: number | string
    name: string
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

    // New author state
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
                .select('author_id, author')

            if (booksData) {
                const counts: Record<string, number> = {}
                booksData.forEach((b: any) => {
                    const key = b.author_id ? String(b.author_id) : b.author?.trim().toLowerCase()
                    if (key) {
                        counts[key] = (counts[key] || 0) + 1
                    }
                })
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

    // Add new author
    async function handleAddAuthor(e?: React.FormEvent) {
        if (e) e.preventDefault()
        const trimmed = newAuthorName.trim()
        if (!trimmed) {
            setAddError('Introduce el nombre del autor o autora.')
            return
        }

        // Check if author already exists in local list (case-insensitive)
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

        const { data, error } = await supabase
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
        setAddSuccess(`Autor "${trimmed}" añadido correctamente.`)
        setTimeout(() => setAddSuccess(null), 3000)
        setAddingAuthor(false)

        await loadAuthors()
        if (onUpdated) onUpdated()
    }

    // Start inline editing
    function startEdit(author: Author) {
        setEditingAuthorId(author.id)
        setEditingAuthorName(author.name)
        setEditError(null)
    }

    // Cancel inline editing
    function cancelEdit() {
        setEditingAuthorId(null)
        setEditingAuthorName('')
        setEditError(null)
    }

    // Save edited author
    async function handleSaveEdit(authorId: number | string) {
        const trimmed = editingAuthorName.trim()
        if (!trimmed) {
            setEditError('El nombre no puede estar vacío.')
            return
        }

        // Check if another author has this name
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

        // 1. Update in authors table
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

        // 2. Also update books table so past/current fairs show the updated name
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

    // Confirm and delete author
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

    // Filter authors by search query
    const filteredAuthors = authors.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-sans">
            <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 text-slate-900 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                            <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                Gestión de Autores
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Catálogo permanente disponible en el desplegable de todas las ferias.
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

                {/* Form to Add Author */}
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 shrink-0">
                    <form onSubmit={handleAddAuthor} className="flex flex-col sm:flex-row items-stretch gap-2.5">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Escribe el nombre del nuevo autor o autora..."
                                value={newAuthorName}
                                onChange={e => {
                                    setNewAuthorName(e.target.value)
                                    if (addError) setAddError(null)
                                }}
                                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
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

                        <button
                            type="submit"
                            disabled={addingAuthor || !newAuthorName.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                            <svg className="w-4 h-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span>{addingAuthor ? 'Guardando...' : 'Añadir Autor'}</span>
                        </button>
                    </form>

                    {addError && (
                        <div className="mt-2.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
                            {addError}
                        </div>
                    )}
                    {addSuccess && (
                        <div className="mt-2.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span>{addSuccess}</span>
                        </div>
                    )}
                </div>

                {/* Search Bar & Total Counter */}
                <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-4 shrink-0">
                    <div className="relative flex-1 max-w-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Filtrar por nombre..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:bg-white"
                        />
                    </div>

                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                        {filteredAuthors.length} de {authors.length} {authors.length === 1 ? 'autor' : 'autores'}
                    </span>
                </div>

                {/* Authors List */}
                <div className="flex-1 overflow-y-auto px-6 py-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 font-medium">
                            <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700 mb-3"></div>
                            <span className="text-sm">Cargando catálogo de autores...</span>
                        </div>
                    ) : filteredAuthors.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                            </div>
                            <p className="text-base font-bold text-slate-800">
                                {searchQuery ? 'No se encontraron autores con esa búsqueda' : 'No hay autores registrados todavía'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                {searchQuery
                                    ? 'Prueba con otro término o añade el autor directamente en el campo superior.'
                                    : 'Añade el primer autor arriba para empezar a organizar tus ferias.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredAuthors.map(author => {
                                const isEditing = editingAuthorId === author.id
                                const count = booksCountByAuthor[String(author.id)] || booksCountByAuthor[author.name.toLowerCase()] || 0

                                return (
                                    <div
                                        key={author.id}
                                        className="py-3 flex items-center justify-between gap-3 group transition hover:bg-slate-50/80 px-2 rounded-xl"
                                    >
                                        {/* Left: Avatar + Name or Inline Edit Input */}
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-black text-xs border border-slate-200">
                                                {author.name.charAt(0).toUpperCase()}
                                            </div>

                                            {isEditing ? (
                                                <div className="flex-1 flex flex-col gap-1 mr-2">
                                                    <input
                                                        type="text"
                                                        value={editingAuthorName}
                                                        onChange={e => setEditingAuthorName(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleSaveEdit(author.id)
                                                            if (e.key === 'Escape') cancelEdit()
                                                        }}
                                                        className="h-8 w-full rounded-lg border border-slate-400 bg-white px-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                                                    />
                                                    {editError && (
                                                        <span className="text-[11px] font-semibold text-red-600">
                                                            {editError}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col truncate">
                                                    <span className="text-sm font-bold text-slate-900 truncate">
                                                        {author.name}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-slate-500">
                                                        {count > 0
                                                            ? `${count} ${count === 1 ? 'libro registrado en ferias' : 'libros registrados en ferias'}`
                                                            : 'Sin libros asignados aún'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSaveEdit(author.id)}
                                                        disabled={updatingAuthor}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                                                        title="Guardar cambios"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                        </svg>
                                                        <span>{updatingAuthor ? 'Guardando...' : 'Guardar'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                                        title="Cancelar edición"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(author)}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition cursor-pointer"
                                                        title={`Editar autor "${author.name}"`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDeletingAuthor(author)
                                                            setDeleteError(null)
                                                        }}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                        title={`Eliminar autor "${author.name}"`}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                    <span className="text-xs text-slate-500 font-medium">
                        Los cambios se reflejarán inmediatamente en las ferias activas y futuras.
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

            {/* Deletion Confirmation Sub-Modal */}
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
                                <strong>Nota:</strong> Este autor tiene {booksCountByAuthor[String(deletingAuthor.id)] || booksCountByAuthor[deletingAuthor.name.toLowerCase()]} libro(s) registrado(s) en ferias. Los libros existentes conservarán su nombre en el historial, pero el autor no aparecerá en el selector para nuevos libros.
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
        </div>
    )
}
