'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type AuthorObj = {
    id: number
    name: string
}

type Book = {
    id: number
    title: string
    author: string | null
    author_id?: number | null
    isbn: string
    price: number
    stock: number
}

type Props = {
    book: Book
    onClose: () => void
    onUpdated: () => void
}

export default function EditBookModal({ book, onClose, onUpdated }: Props) {
    // Form fields initialized with existing book data
    const [title, setTitle] = useState(book.title)
    const [selectedAuthor, setSelectedAuthor] = useState<AuthorObj | null>(
        book.author ? { id: book.author_id || 0, name: book.author } : null
    )
    const [authorSearchQuery, setAuthorSearchQuery] = useState(book.author || '')
    const [isbn, setIsbn] = useState(book.isbn || '')
    const [price, setPrice] = useState(book.price.toString())
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [missingFields, setMissingFields] = useState<string[]>([])

    // Authors state
    const [existingAuthors, setExistingAuthors] = useState<AuthorObj[]>([])
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [loadingAuthors, setLoadingAuthors] = useState(true)
    const authorComboboxRef = useRef<HTMLDivElement>(null)

    // Sub-modal for creating a new author
    const [showNewAuthorModal, setShowNewAuthorModal] = useState(false)
    const [newAuthorName, setNewAuthorName] = useState('')
    const [creatingAuthor, setCreatingAuthor] = useState(false)
    const [newAuthorError, setNewAuthorError] = useState<string | null>(null)

    // Fetch existing authors from the authors table in Supabase
    async function loadAuthors() {
        setLoadingAuthors(true)
        const { data, error } = await supabase
            .from('authors')
            .select('id, name')
            .order('name')

        if (!error && data) {
            const sortedList = (data as AuthorObj[]).sort((a, b) =>
                a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
            )
            setExistingAuthors(sortedList)

            // Sync selected author object with database if matched by name or id
            if (book.author) {
                const match = sortedList.find(
                    a => a.id === book.author_id || a.name.toLowerCase() === book.author?.toLowerCase()
                )
                if (match) {
                    setSelectedAuthor(match)
                }
            }
        }
        setLoadingAuthors(false)
    }

    useEffect(() => {
        loadAuthors()
    }, [book.author, book.author_id])

    // Click outside handler for author combobox
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (authorComboboxRef.current && !authorComboboxRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filter existing authors matching search query
    const filteredAuthors = existingAuthors.filter(a =>
        a.name.toLowerCase().includes(authorSearchQuery.toLowerCase().trim())
    )

    // Create a new author explicitly in the authors table
    async function handleCreateNewAuthor() {
        const nameTrimmed = newAuthorName.trim()
        if (!nameTrimmed) {
            setNewAuthorError('Introduce el nombre del autor/a.')
            return
        }

        setCreatingAuthor(true)
        setNewAuthorError(null)

        // Check for duplicates in authors table
        const { data: existing } = await supabase
            .from('authors')
            .select('id, name')
            .ilike('name', nameTrimmed)
            .maybeSingle()

        if (existing) {
            setSelectedAuthor(existing)
            setAuthorSearchQuery(existing.name)
            setShowNewAuthorModal(false)
            setNewAuthorName('')
            setCreatingAuthor(false)
            return
        }

        const { data: created, error } = await supabase
            .from('authors')
            .insert({ name: nameTrimmed })
            .select('id, name')
            .single()

        if (error) {
            console.error('Error creating author:', error)
            setNewAuthorError('Error al crear el autor en la base de datos.')
            setCreatingAuthor(false)
            return
        }

        if (created) {
            setSelectedAuthor(created)
            setAuthorSearchQuery(created.name)
            await loadAuthors()
        }

        setCreatingAuthor(false)
        setShowNewAuthorModal(false)
        setNewAuthorName('')
    }

    // Submit handler to update book in Supabase
    async function handleSubmit() {
        const missing: string[] = []
        if (!title.trim()) missing.push('Título')
        if (!selectedAuthor) missing.push('Autor')
        if (!isbn.trim()) missing.push('ISBN')
        if (!price || parseFloat(price) <= 0) missing.push('Precio')

        setMissingFields(missing)

        if (missing.length > 0) {
            setErrorMsg(`Por favor, completa los campos obligatorios: ${missing.join(', ')}.`)
            return
        }

        setSaving(true)
        setErrorMsg(null)

        const { error } = await supabase
            .from('books')
            .update({
                title: title.trim(),
                author: selectedAuthor?.name,
                author_id: selectedAuthor?.id,
                isbn: isbn.trim(),
                price: parseFloat(price) || 0,
            })
            .eq('id', book.id)

        if (error) {
            console.error('Error updating book:', error)
            if (error.code === '23505') {
                setErrorMsg('Ya existe otro libro registrado con este ISBN en esta feria.')
            } else {
                setErrorMsg(error.message || 'Error al actualizar el libro')
            }
            setSaving(false)
            return
        }

        setSaving(false)
        onUpdated()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-sans">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200/80 text-slate-900">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white shadow-xs">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 tracking-tight">Editar libro</h3>
                            <p className="text-xs text-slate-500">Modifica los datos del título seleccionado</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        title="Cerrar"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {errorMsg && (
                    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600 font-medium">
                        {errorMsg}
                    </div>
                )}

                {/* Form fields */}
                <div className="flex flex-col gap-4">
                    {/* Título */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                                Título del libro <span className="text-red-500 font-bold">*</span>
                            </label>
                            {missingFields.includes('Título') && (
                                <span className="text-[11px] font-medium text-red-500">Obligatorio</span>
                            )}
                        </div>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={title}
                                onChange={e => {
                                    setTitle(e.target.value)
                                    if (missingFields.includes('Título')) {
                                        setMissingFields(prev => prev.filter(f => f !== 'Título'))
                                    }
                                }}
                                className={`h-10 w-full rounded-xl border pl-9.5 pr-3 text-sm text-slate-900 outline-none transition ${missingFields.includes('Título')
                                        ? 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                                        : 'border-slate-300 bg-slate-50/50 hover:bg-white hover:border-slate-400 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Autor */}
                    <div ref={authorComboboxRef} className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                                Autor / Autora <span className="text-red-500 font-bold">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setNewAuthorName(authorSearchQuery)
                                    setNewAuthorError(null)
                                    setShowNewAuthorModal(true)
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200/60 px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                            >
                                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span>Nuevo autor</span>
                            </button>
                        </div>

                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder={loadingAuthors ? "Cargando autores..." : "Buscar o seleccionar autor..."}
                                value={authorSearchQuery}
                                onFocus={() => setIsDropdownOpen(true)}
                                onChange={e => {
                                    setAuthorSearchQuery(e.target.value)
                                    setSelectedAuthor(null)
                                    setIsDropdownOpen(true)
                                    if (missingFields.includes('Autor')) {
                                        setMissingFields(prev => prev.filter(f => f !== 'Autor'))
                                    }
                                }}
                                className={`h-10 w-full rounded-xl border pl-9.5 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition ${missingFields.includes('Autor')
                                        ? 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                                        : selectedAuthor
                                            ? 'border-slate-300 bg-slate-100/70 font-medium'
                                            : 'border-slate-300 bg-slate-50/50 hover:bg-white hover:border-slate-400 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                    }`}
                            />
                            {selectedAuthor ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedAuthor(null)
                                        setAuthorSearchQuery('')
                                        setIsDropdownOpen(true)
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                                    title="Quitar selección"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            ) : (
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                    </svg>
                                </span>
                            )}
                        </div>

                        {/* Dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg text-sm">
                                {filteredAuthors.map(a => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedAuthor(a)
                                            setAuthorSearchQuery(a.name)
                                            setIsDropdownOpen(false)
                                        }}
                                        className={`flex items-center justify-between w-full px-3.5 py-2 text-xs text-left transition cursor-pointer ${selectedAuthor?.id === a.id
                                                ? 'bg-slate-100 font-semibold text-slate-900'
                                                : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span>{a.name}</span>
                                        {selectedAuthor?.id === a.id && (
                                            <svg className="w-4 h-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                                {filteredAuthors.length === 0 && (
                                    <div className="px-3.5 py-2 text-xs text-slate-400">No se encontraron autores existentes</div>
                                )}
                                {authorSearchQuery.trim() && !filteredAuthors.some(a => a.name.toLowerCase() === authorSearchQuery.trim().toLowerCase()) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewAuthorName(authorSearchQuery.trim())
                                            setNewAuthorError(null)
                                            setShowNewAuthorModal(true)
                                            setIsDropdownOpen(false)
                                        }}
                                        className="flex items-center gap-1.5 w-full border-t border-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 transition text-left cursor-pointer"
                                    >
                                        <span className="text-slate-400 font-bold">+</span>
                                        <span>Crear &quot;{authorSearchQuery.trim()}&quot; como nuevo autor</span>
                                    </button>
                                )}
                            </div>
                        )}
                        {missingFields.includes('Autor') && !isDropdownOpen && (
                            <p className="mt-1 text-[11px] font-medium text-red-500">Debes seleccionar o crear un autor</p>
                        )}
                    </div>

                    {/* ISBN */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                                ISBN <span className="text-red-500 font-bold">*</span>
                            </label>
                            {missingFields.includes('ISBN') && (
                                <span className="text-[11px] font-medium text-red-500">Obligatorio</span>
                            )}
                        </div>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5v15m3.75-15v15m3-15v15m3.75-15v15m3-15v15m3.75-15v15" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={isbn}
                                onChange={e => {
                                    setIsbn(e.target.value)
                                    if (missingFields.includes('ISBN')) {
                                        setMissingFields(prev => prev.filter(f => f !== 'ISBN'))
                                    }
                                }}
                                className={`h-10 w-full rounded-xl border pl-9.5 pr-3 text-sm text-slate-900 outline-none transition ${missingFields.includes('ISBN')
                                        ? 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                                        : 'border-slate-300 bg-slate-50/50 hover:bg-white hover:border-slate-400 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Precio */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                                Precio (€) <span className="text-red-500 font-bold">*</span>
                            </label>
                            {missingFields.includes('Precio') && (
                                <span className="text-[11px] font-medium text-red-500">Obligatorio</span>
                            )}
                        </div>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={e => {
                                    setPrice(e.target.value)
                                    if (missingFields.includes('Precio')) {
                                        setMissingFields(prev => prev.filter(f => f !== 'Precio'))
                                    }
                                }}
                                className={`h-10 w-full rounded-xl border pl-9.5 pr-7 text-sm text-slate-900 outline-none transition ${missingFields.includes('Precio')
                                        ? 'border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                                        : 'border-slate-300 bg-slate-50/50 hover:bg-white hover:border-slate-400 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                    }`}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                €
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="h-10 rounded-xl bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
                    </button>
                </div>
            </div>

            {/* Dedicated Modal for Creating a New Author */}
            {showNewAuthorModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl border border-slate-200 text-slate-900">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <h4 className="text-sm font-semibold text-slate-900">Nuevo autor</h4>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewAuthorModal(false)
                                    setNewAuthorName('')
                                    setNewAuthorError(null)
                                }}
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {newAuthorError && (
                            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-600 font-medium">
                                {newAuthorError}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-slate-700">Nombre completo</label>
                            <input
                                type="text"
                                value={newAuthorName}
                                onChange={e => setNewAuthorName(e.target.value)}
                                autoFocus
                                className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            />
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewAuthorModal(false)
                                    setNewAuthorName('')
                                    setNewAuthorError(null)
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateNewAuthor}
                                disabled={creatingAuthor}
                                className="rounded-lg bg-slate-700 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
                            >
                                {creatingAuthor ? 'Guardando...' : 'Guardar autor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
