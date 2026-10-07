'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type AuthorObj = {
    id: number
    name: string
}

type Props = {
    fairId: number | string
    onClose: () => void
    onCreated: () => void
}

export default function NewBookModal({ fairId, onClose, onCreated }: Props) {
    // Form fields state
    const [title, setTitle] = useState('')
    const [selectedAuthor, setSelectedAuthor] = useState<AuthorObj | null>(null)
    const [authorSearchQuery, setAuthorSearchQuery] = useState('')
    const [isbn, setIsbn] = useState('')
    const [price, setPrice] = useState('')
    const [stock, setStock] = useState('1')
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
        }
        setLoadingAuthors(false)
    }

    useEffect(() => {
        loadAuthors()
    }, [])

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

    // Submit handler to insert book into Supabase
    async function handleSubmit() {
        const missing: string[] = []
        if (!title.trim()) missing.push('Título')
        if (!selectedAuthor) missing.push('Autor')
        if (!isbn.trim()) missing.push('ISBN')
        if (!price || parseFloat(price) <= 0) missing.push('Precio')
        if (!stock || parseInt(stock) < 1) missing.push('Stock')

        if (missing.length > 0) {
            setErrorMsg(`Por favor, completa los campos obligatorios: ${missing.join(', ')}.`)
            return
        }

        setSaving(true)
        setErrorMsg(null)

        const initialStockNum = parseInt(stock) || 1

        const { data: newBook, error } = await supabase
            .from('books')
            .insert({
                fair_id: Number(fairId),
                title: title.trim(),
                author: selectedAuthor?.name,
                author_id: selectedAuthor?.id,
                isbn: isbn.trim(),
                price: parseFloat(price) || 0,
                stock: initialStockNum,
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating book:', error)
            if (error.code === '23505') {
                setErrorMsg('Ya existe un libro registrado con este ISBN en esta feria.')
            } else {
                setErrorMsg(error.message || 'Error al guardar el libro')
            }
            setSaving(false)
            return
        }

        // Record initial stock movement for history audit log
        if (newBook) {
            await supabase.from('stock_movements').insert({
                fair_id: Number(fairId),
                book_id: newBook.id,
                quantity: initialStockNum,
                movement_type: 'initial',
            })
        }

        setSaving(false)
        onCreated()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-sans">
            <div className="w-full max-w-md rounded-2xl bg-[#fafafa] p-8 shadow-xl border border-slate-200 text-slate-900">
                <h3 className="mb-6 text-2xl font-extrabold text-slate-900 tracking-tight">Añadir Nuevo Libro</h3>

                {errorMsg && (
                    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-semibold">
                        {errorMsg}
                    </div>
                )}

                {/* Form inputs */}
                <div className="flex flex-col gap-4">
                    {/* Title */}
                    <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-800">Título del libro *</label>
                        <input
                            type="text"
                            placeholder="Ej. El Quijote de la Mancha"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                        />
                    </div>

                    {/* Author Searchable Selector */}
                    <div ref={authorComboboxRef} className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-bold text-slate-800">Autor / Autora *</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setNewAuthorName(authorSearchQuery)
                                    setNewAuthorError(null)
                                    setShowNewAuthorModal(true)
                                }}
                                className="text-xs font-bold text-slate-700 hover:text-slate-900 hover:underline transition"
                            >
                                + Crear nuevo autor
                            </button>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                placeholder={loadingAuthors ? "Cargando autores..." : "Buscar y seleccionar autor registrado..."}
                                value={authorSearchQuery}
                                onFocus={() => setIsDropdownOpen(true)}
                                onChange={e => {
                                    setAuthorSearchQuery(e.target.value)
                                    setSelectedAuthor(null) // Reset selection when typing search query
                                    setIsDropdownOpen(true)
                                }}
                                className={`w-full rounded-xl border px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition ${
                                    selectedAuthor
                                        ? 'border-emerald-500 bg-emerald-50/30 font-bold'
                                        : 'border-slate-300 bg-white focus:border-slate-800'
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
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-800"
                                >
                                    ✕
                                </button>
                            ) : (
                                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    ▼
                                </span>
                            )}
                        </div>

                        {/* Floating suggestions dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl border border-slate-300 bg-white p-1.5 shadow-xl">
                                {filteredAuthors.length > 0 ? (
                                    <>
                                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Autores registrados ({filteredAuthors.length})
                                        </div>
                                        {filteredAuthors.map(a => (
                                            <button
                                                key={a.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedAuthor(a)
                                                    setAuthorSearchQuery(a.name)
                                                    setIsDropdownOpen(false)
                                                }}
                                                className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-bold text-left transition ${
                                                    selectedAuthor?.id === a.id
                                                        ? 'bg-slate-900 text-white'
                                                        : 'text-slate-800 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span>👤 {a.name}</span>
                                                {selectedAuthor?.id === a.id && (
                                                    <span className="text-[10px] opacity-80">Seleccionado</span>
                                                )}
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    <div className="p-3 text-center">
                                        <p className="text-xs font-medium text-slate-500 mb-2">
                                            No existe ningún autor registrado con &quot;{authorSearchQuery}&quot;
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewAuthorName(authorSearchQuery)
                                                setNewAuthorError(null)
                                                setShowNewAuthorModal(true)
                                                setIsDropdownOpen(false)
                                            }}
                                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 border border-slate-300 hover:bg-slate-200 transition"
                                        >
                                            ➕ Crear &quot;{authorSearchQuery}&quot; como nuevo autor
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ISBN */}
                    <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-800">ISBN *</label>
                        <input
                            type="text"
                            placeholder="Ej. 978-84-376-0494-7"
                            value={isbn}
                            onChange={e => setIsbn(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                        />
                    </div>

                    <div className="flex gap-4">
                        {/* Price */}
                        <div className="flex-1">
                            <label className="mb-1.5 block text-sm font-bold text-slate-800">Precio (€) *</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>

                        {/* Stock */}
                        <div className="flex-1">
                            <label className="mb-1.5 block text-sm font-bold text-slate-800">Stock Inicial *</label>
                            <input
                                type="number"
                                min="1"
                                value={stock}
                                onChange={e => setStock(e.target.value)}
                                required
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Añadir Libro'}
                    </button>
                </div>
            </div>

            {/* Dedicated Modal for Creating a New Author */}
            {showNewAuthorModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-[#fafafa] p-6 shadow-2xl border border-slate-200 text-slate-900">
                        <h4 className="text-xl font-extrabold text-slate-900 tracking-tight mb-4">Añadir Nuevo Autor</h4>

                        {newAuthorError && (
                            <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs font-semibold text-red-700">
                                {newAuthorError}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-700">Nombre del Autor/a *</label>
                            <input
                                type="text"
                                placeholder="Ej. Gabriel García Márquez"
                                value={newAuthorName}
                                onChange={e => setNewAuthorName(e.target.value)}
                                autoFocus
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-800"
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewAuthorModal(false)
                                    setNewAuthorName('')
                                    setNewAuthorError(null)
                                }}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/60 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateNewAuthor}
                                disabled={creatingAuthor}
                                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition"
                            >
                                {creatingAuthor ? 'Guardando...' : 'Guardar Autor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
