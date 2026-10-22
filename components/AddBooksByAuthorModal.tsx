'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface AuthorObj {
    id: number | string
    name: string
}

interface KnownBook {
    key: string
    title: string
    isbn: string
    price: number
    selected: boolean
    stock: string
    alreadyInFair: boolean
    currentBookId?: number | string
    currentStock?: number
}

interface Props {
    fairId: number | string
    onClose: () => void
    onBooksAdded: () => void
}

export default function AddBooksByAuthorModal({ fairId, onClose, onBooksAdded }: Props) {
    // Authors state
    const [authors, setAuthors] = useState<AuthorObj[]>([])
    const [selectedAuthor, setSelectedAuthor] = useState<AuthorObj | null>(null)
    const [authorSearchQuery, setAuthorSearchQuery] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [loadingAuthors, setLoadingAuthors] = useState(true)
    const [creatingAuthor, setCreatingAuthor] = useState(false)
    const [showNewAuthorModal, setShowNewAuthorModal] = useState(false)
    const [newAuthorName, setNewAuthorName] = useState('')
    const [newAuthorError, setNewAuthorError] = useState<string | null>(null)
    const authorComboboxRef = useRef<HTMLDivElement>(null)

    // Books state
    const [knownBooks, setKnownBooks] = useState<KnownBook[]>([])
    const [loadingBooks, setLoadingBooks] = useState(false)
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    // Inline add new book state
    const [showNewBookForm, setShowNewBookForm] = useState(false)
    const [newTitle, setNewTitle] = useState('')
    const [newIsbn, setNewIsbn] = useState('')
    const [newPrice, setNewPrice] = useState('')
    const [newBookError, setNewBookError] = useState<string | null>(null)

    // Auto-dismiss success message after 5 seconds
    useEffect(() => {
        if (!successMsg) return
        const timer = setTimeout(() => {
            setSuccessMsg(null)
        }, 5000)
        return () => clearTimeout(timer)
    }, [successMsg])

    // Close author dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (authorComboboxRef.current && !authorComboboxRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Fetch existing authors
    async function loadAuthors() {
        setLoadingAuthors(true)
        const { data, error } = await supabase
            .from('authors')
            .select('id, name')
            .order('name')

        if (!error && data) {
            const sorted = (data as AuthorObj[]).sort((a, b) =>
                a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
            )
            setAuthors(sorted)
        }
        setLoadingAuthors(false)
    }

    useEffect(() => {
        loadAuthors()
    }, [])

    // Filter authors by search
    const filteredAuthors = authors.filter(a =>
        a.name.toLowerCase().includes(authorSearchQuery.toLowerCase().trim())
    )

    // Create a new author right from this modal in the global authors database
    async function handleCreateNewAuthor(customName?: string) {
        const raw = typeof customName === 'string' ? customName : (newAuthorName.trim() || authorSearchQuery.trim())
        const trimmed = raw.trim()
        if (!trimmed) {
            setNewAuthorError('Introduce el nombre del autor/a.')
            return
        }
        setCreatingAuthor(true)
        setNewAuthorError(null)
        setErrorMsg(null)

        try {
            // Check if author exists
            const { data: existing } = await supabase
                .from('authors')
                .select('id, name')
                .ilike('name', trimmed)
                .maybeSingle()

            if (existing) {
                setCreatingAuthor(false)
                setShowNewAuthorModal(false)
                setNewAuthorName('')
                handleSelectAuthor(existing)
                setSuccessMsg(`Autor "${existing.name}" seleccionado (ya existía en la base de datos).`)
                return
            }

            const { data: created, error } = await supabase
                .from('authors')
                .insert({ name: trimmed })
                .select('id, name')
                .single()

            if (error || !created) {
                console.error('Error creating author:', error)
                setNewAuthorError('Error al registrar nuevo autor en la base de datos.')
                setErrorMsg('Error al registrar nuevo autor en Supabase.')
                setCreatingAuthor(false)
                return
            }

            await loadAuthors()
            setCreatingAuthor(false)
            setShowNewAuthorModal(false)
            setNewAuthorName('')
            handleSelectAuthor(created)
            setSuccessMsg(`Autor/a "${created.name}" registrado en la base de datos general.`)
        } catch (err: any) {
            console.error('Error creating author:', err)
            setNewAuthorError(err.message || 'Error inesperado al crear autor.')
            setCreatingAuthor(false)
        }
    }

    // Load books for selected author across fairs and check if already in current fair
    async function handleSelectAuthor(author: AuthorObj) {
        setSelectedAuthor(author)
        setAuthorSearchQuery(author.name)
        setIsDropdownOpen(false)
        setLoadingBooks(true)
        setErrorMsg(null)
        setSuccessMsg(null)
        setShowNewBookForm(false)

        try {
            // 1. Fetch all books from this current fair to know what already exists
            const { data: currentFairBooks } = await supabase
                .from('books')
                .select('id, title, isbn, price, stock')
                .eq('fair_id', Number(fairId))

            const fairBooksByIsbn = new Map<string, any>()
            const fairBooksByTitle = new Map<string, any>()
            ;(currentFairBooks || []).forEach(b => {
                if (b.isbn) fairBooksByIsbn.set(b.isbn.trim().toLowerCase(), b)
                if (b.title) fairBooksByTitle.set(b.title.trim().toLowerCase(), b)
            })

            // 2. Fetch all books historically associated with this author
            const { data: authorBooks, error } = await supabase
                .from('books')
                .select('title, isbn, price, author, author_id')
                .or(`author_id.eq.${author.id},author.ilike.${author.name.trim()}`)

            if (error) {
                console.error('Error fetching author books:', error)
                setErrorMsg('Error al consultar los libros del autor.')
                setLoadingBooks(false)
                return
            }

            // Deduplicate books by title or ISBN
            const deduplicated = new Map<string, KnownBook>()
            ;(authorBooks || []).forEach((b: any) => {
                const cleanTitle = b.title?.trim()
                const cleanIsbn = b.isbn?.trim() || ''
                if (!cleanTitle) return

                const key = (cleanIsbn || cleanTitle).toLowerCase()
                if (!deduplicated.has(key)) {
                    // Check if already in current fair
                    const existingInFair = fairBooksByIsbn.get(cleanIsbn.toLowerCase()) || fairBooksByTitle.get(cleanTitle.toLowerCase())
                    const isAlreadyInFair = Boolean(existingInFair)

                    deduplicated.set(key, {
                        key,
                        title: cleanTitle,
                        isbn: cleanIsbn,
                        price: Number(b.price) || 0,
                        selected: false, // Start unselected
                        stock: '0', // Default real stock is 0
                        alreadyInFair: isAlreadyInFair,
                        currentBookId: existingInFair?.id,
                        currentStock: existingInFair?.stock,
                    })
                }
            })

            setKnownBooks(Array.from(deduplicated.values()))
        } catch (err) {
            console.error('Error loading author books:', err)
            setErrorMsg('Error inesperado al cargar libros.')
        } finally {
            setLoadingBooks(false)
        }
    }

    // Toggle book selection (strictly ignored if already in fair)
    function toggleBookSelected(key: string) {
        setErrorMsg(null)
        setKnownBooks(prev =>
            prev.map(b => {
                if (b.key === key) {
                    if (b.alreadyInFair) return b // Cannot be selected
                    const newSelected = !b.selected
                    return {
                        ...b,
                        selected: newSelected,
                        stock: b.stock && b.stock.trim() !== '' ? b.stock : '0',
                    }
                }
                return b
            })
        )
    }

    // Update stock for a specific book
    function updateBookStock(key: string, value: string) {
        setErrorMsg(null)
        setKnownBooks(prev =>
            prev.map(b => (b.key === key && !b.alreadyInFair ? { ...b, stock: value } : b))
        )
    }

    // Select all / Deselect all (only applies to books not already in fair)
    function selectAllBooks(select: boolean) {
        setErrorMsg(null)
        setKnownBooks(prev =>
            prev.map(b => {
                if (b.alreadyInFair) return b // Skip already in fair
                return {
                    ...b,
                    selected: select,
                    stock: b.stock && b.stock.trim() !== '' ? b.stock : '0',
                }
            })
        )
    }

    // Add a brand new book for this author directly into the modal list
    async function handleAddNewBookToList(e: React.FormEvent) {
        e.preventDefault()
        setNewBookError(null)

        const titleTrimmed = newTitle.trim()
        const isbnTrimmed = newIsbn.trim()
        const priceNum = parseFloat(newPrice)

        if (!titleTrimmed) {
            setNewBookError('Introduce el título del libro.')
            return
        }
        if (!isbnTrimmed) {
            setNewBookError('Introduce el ISBN.')
            return
        }
        if (isNaN(priceNum) || priceNum <= 0) {
            setNewBookError('Introduce un precio válido.')
            return
        }

        // Check if book is already in current fair in Supabase
        const { data: currentFairBooks } = await supabase
            .from('books')
            .select('id, title, isbn, stock')
            .eq('fair_id', Number(fairId))

        const alreadyInCurrent = (currentFairBooks || []).find(
            b => (b.isbn && b.isbn.trim().toLowerCase() === isbnTrimmed.toLowerCase()) ||
                 (b.title && b.title.trim().toLowerCase() === titleTrimmed.toLowerCase())
        )

        if (alreadyInCurrent) {
            setNewBookError(
                `Este libro ya está registrado en esta feria (Stock: ${alreadyInCurrent.stock} uds.). Para modificar sus unidades, usa los botones (+ / -) de la tabla.`
            )
            return
        }

        const key = (isbnTrimmed || titleTrimmed).toLowerCase()
        if (knownBooks.some(b => b.key === key)) {
            setNewBookError('Este libro ya está en la lista de este autor.')
            return
        }

        const newEntry: KnownBook = {
            key,
            title: titleTrimmed,
            isbn: isbnTrimmed,
            price: priceNum,
            selected: false,
            stock: '0',
            alreadyInFair: false,
        }

        setKnownBooks(prev => [newEntry, ...prev])
        setNewTitle('')
        setNewIsbn('')
        setNewPrice('')
        setShowNewBookForm(false)
        setSuccessMsg(`"${titleTrimmed}" añadido a la lista. Selecciónalo e indica el stock inicial con el que lo llevarás.`)
    }

    // Submit batch books into current fair (only new books)
    async function handleSaveBooksToFair() {
        if (!selectedAuthor) return

        const selectedBooks = knownBooks.filter(b => b.selected && !b.alreadyInFair)
        if (selectedBooks.length === 0) {
            setErrorMsg('Selecciona al menos un libro disponible para añadir a la feria.')
            return
        }

        // Validate stock quantities (0 is perfectly valid, empty counts as 0)
        for (const b of selectedBooks) {
            const trimmed = (b.stock ?? '').trim()
            const qty = trimmed === '' ? 0 : parseInt(trimmed, 10)
            if (isNaN(qty) || qty < 0) {
                setErrorMsg(`Indica un stock válido (0 o mayor) para "${b.title}".`)
                return
            }
        }

        setSaving(true)
        setErrorMsg(null)

        try {
            let addedCount = 0

            for (const b of selectedBooks) {
                const trimmed = (b.stock ?? '').trim()
                const qty = trimmed === '' ? 0 : parseInt(trimmed, 10)

                const { data: newBook, error: insertErr } = await supabase
                    .from('books')
                    .insert({
                        fair_id: Number(fairId),
                        title: b.title,
                        author: selectedAuthor.name,
                        author_id: selectedAuthor.id,
                        isbn: b.isbn,
                        price: b.price,
                        stock: qty,
                    })
                    .select()
                    .single()

                if (!insertErr && newBook) {
                    await supabase.from('stock_movements').insert({
                        fair_id: Number(fairId),
                        book_id: newBook.id,
                        quantity: qty,
                        movement_type: 'initial',
                        notes: `Stock inicial por lote autor (${selectedAuthor.name})`,
                    })
                    addedCount++
                }
            }

            setSuccessMsg(
                `¡Libros añadidos correctamente! Se han incorporado ${addedCount} ${addedCount === 1 ? 'libro' : 'libros'} a la feria.`
            )
            onBooksAdded()
            setTimeout(() => {
                onClose()
            }, 600)
        } catch (err: any) {
            console.error('Error saving batch books:', err)
            setErrorMsg(err.message || 'Error al guardar libros en la feria.')
        } finally {
            setSaving(false)
        }
    }

    const availableBooksCount = knownBooks.filter(b => !b.alreadyInFair).length
    const selectedCount = knownBooks.filter(b => b.selected && !b.alreadyInFair).length

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-sans">
            <div className="flex flex-col w-full max-w-2xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 text-slate-900 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                            <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                Añadir Libros a la Feria
                            </h3>
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

                {/* Author Selector Bar */}
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Autor/a
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setNewAuthorName(authorSearchQuery.trim())
                                setNewAuthorError(null)
                                setShowNewAuthorModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                            title="Crear un nuevo autor en la base de datos general"
                        >
                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span>Nuevo Autor</span>
                        </button>
                    </div>

                    <div ref={authorComboboxRef} className="relative">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={loadingAuthors ? 'Cargando lista de autores...' : 'Escribe o busca un autor...'}
                                value={authorSearchQuery}
                                onFocus={() => setIsDropdownOpen(true)}
                                onChange={e => {
                                    setAuthorSearchQuery(e.target.value)
                                    setIsDropdownOpen(true)
                                }}
                                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                            {authorSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAuthorSearchQuery('')
                                        setSelectedAuthor(null)
                                        setKnownBooks([])
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Author suggestions dropdown */}
                        {isDropdownOpen && (
                            <div className="absolute left-0 right-0 top-11 z-50 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                {filteredAuthors.length === 0 ? (
                                    <div className="p-3 text-center">
                                        <p className="text-xs text-slate-500 font-medium mb-2">
                                            No se encontró ningún autor con &quot;{authorSearchQuery}&quot;
                                        </p>
                                        {authorSearchQuery.trim() && (
                                            <button
                                                type="button"
                                                onClick={handleCreateNewAuthor}
                                                disabled={creatingAuthor}
                                                className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition cursor-pointer"
                                            >
                                                <svg className="w-3.5 h-3.5 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                </svg>
                                                <span>{creatingAuthor ? 'Registrando...' : `Crear "${authorSearchQuery.trim()}" como nuevo autor`}</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {filteredAuthors.map(author => (
                                            <button
                                                key={author.id}
                                                type="button"
                                                onClick={() => handleSelectAuthor(author)}
                                                className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 text-left transition cursor-pointer"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                                                        {author.name.charAt(0).toUpperCase()}
                                                    </span>
                                                    <span className="text-sm font-bold">{author.name}</span>
                                                </span>
                                                <span className="text-[11px] text-slate-400 font-medium">Seleccionar</span>
                                            </button>
                                        ))}

                                        {/* Option to create new author if search query is not exact match */}
                                        {authorSearchQuery.trim() && !filteredAuthors.some(a => a.name.toLowerCase() === authorSearchQuery.trim().toLowerCase()) && (
                                            <button
                                                type="button"
                                                onClick={handleCreateNewAuthor}
                                                disabled={creatingAuthor}
                                                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 text-left transition cursor-pointer border-t border-slate-100 mt-1 pt-2"
                                            >
                                                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                </svg>
                                                <span>{creatingAuthor ? 'Registrando...' : `Crear "${authorSearchQuery.trim()}" como nuevo autor`}</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {errorMsg && (
                        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span>{successMsg}</span>
                        </div>
                    )}

                    {!selectedAuthor ? (
                        <div className="py-16 text-center text-slate-500">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-slate-700">Elige o escribe un autor para comenzar</p>
                        </div>
                    ) : loadingBooks ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 font-medium">
                            <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-700 mb-3"></div>
                            <span className="text-sm">Buscando libros de {selectedAuthor.name}...</span>
                        </div>
                    ) : (
                        <div>
                            {/* Toolbar: Counter + Select All + Add New Book Button */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700">
                                        Libros de <strong>{selectedAuthor.name}</strong> ({knownBooks.length})
                                    </span>
                                    {availableBooksCount > 0 && (
                                        <div className="flex items-center gap-1.5 ml-2">
                                            <button
                                                type="button"
                                                onClick={() => selectAllBooks(true)}
                                                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                                            >
                                                Marcar disponibles
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                type="button"
                                                onClick={() => selectAllBooks(false)}
                                                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                                            >
                                                Desmarcar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowNewBookForm(prev => !prev)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    <span>{showNewBookForm ? 'Cerrar formulario' : 'Añadir nuevo libro a este autor'}</span>
                                </button>
                            </div>

                            {/* Inline Form for Adding a New Book for this Author */}
                            {showNewBookForm && (
                                <form onSubmit={handleAddNewBookToList} className="mb-4 rounded-xl border border-slate-300 bg-slate-50/80 p-4 shadow-2xs">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                                        Registrar un nuevo libro para {selectedAuthor.name}
                                    </h4>

                                    {newBookError && (
                                        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs font-semibold text-red-700">
                                            {newBookError}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 mb-1 block">Título *</label>
                                            <input
                                                type="text"
                                                placeholder="Ej. La sombra del viento"
                                                value={newTitle}
                                                onChange={e => setNewTitle(e.target.value)}
                                                className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 mb-1 block">ISBN *</label>
                                            <input
                                                type="text"
                                                placeholder="978-..."
                                                value={newIsbn}
                                                onChange={e => setNewIsbn(e.target.value)}
                                                className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-800 font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-3 max-w-xs">
                                        <label className="text-[11px] font-bold text-slate-700 mb-1 block">Precio Original (€) *</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="18.00"
                                            value={newPrice}
                                            onChange={e => setNewPrice(e.target.value)}
                                            className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-slate-800"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowNewBookForm(false)}
                                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            className="rounded-lg bg-slate-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                                        >
                                            Incluir en la lista
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Books Checklist */}
                            {knownBooks.length === 0 ? (
                                <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6">
                                    <p className="text-sm font-bold text-slate-800">No hay libros registrados aún para este autor</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                        Pulsa en <strong>&quot;Añadir nuevo libro a este autor&quot;</strong> arriba para registrar el primer libro de {selectedAuthor.name} y llevarlo a esta feria.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {knownBooks.map(b => {
                                        // Case 1: Already registered in this fair (DISABLED)
                                        if (b.alreadyInFair) {
                                            return (
                                                <div
                                                    key={b.key}
                                                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/80 opacity-60 select-none cursor-not-allowed"
                                                    title="Este libro ya está en la feria. Para modificar stock, usa (+ / -) en la tabla."
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            disabled
                                                            className="h-4.5 w-4.5 rounded border-slate-300 text-slate-400 cursor-not-allowed shrink-0"
                                                        />
                                                        <div className="truncate">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-slate-600 truncate">
                                                                    {b.title}
                                                                </span>
                                                                <span className="shrink-0 rounded-md bg-slate-200 text-slate-700 px-2 py-0.5 text-[10px] font-extrabold border border-slate-300">
                                                                    Ya en la feria (Stock: {b.currentStock} uds.)
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium mt-0.5">
                                                                {b.isbn && <span className="font-mono text-[11px]">{b.isbn}</span>}
                                                                <span>•</span>
                                                                <span>Precio: {b.price.toFixed(2)} €</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        // Case 2: Available book to add
                                        return (
                                            <div
                                                key={b.key}
                                                onClick={() => toggleBookSelected(b.key)}
                                                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer ${
                                                    b.selected
                                                        ? 'border-slate-800/40 bg-slate-50 shadow-2xs'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                }`}
                                            >
                                                {/* Left: Checkbox + Book Info */}
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={b.selected}
                                                        onChange={() => {}} // handled by parent div onClick
                                                        className="h-4.5 w-4.5 rounded border-slate-300 text-slate-700 focus:ring-slate-700 cursor-pointer shrink-0"
                                                    />
                                                    <div className="truncate">
                                                        <span className="text-sm font-bold text-slate-900 truncate block">
                                                            {b.title}
                                                        </span>
                                                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                                                            {b.isbn && <span className="font-mono text-[11px]">{b.isbn}</span>}
                                                            <span>•</span>
                                                            <span>Precio: <strong>{b.price.toFixed(2)} €</strong></span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Quantity input */}
                                                <div
                                                    className="flex items-center gap-2 shrink-0"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        if (!b.selected) toggleBookSelected(b.key)
                                                    }}
                                                >
                                                    <span className={`text-xs font-bold transition ${b.selected ? 'text-slate-800' : 'text-slate-400'} hidden sm:inline`}>
                                                        Stock inicial:
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={b.stock}
                                                        disabled={!b.selected}
                                                        onChange={e => updateBookStock(b.key, e.target.value)}
                                                        className={`w-20 h-8.5 rounded-lg border text-center text-xs font-bold outline-none transition ${
                                                            b.selected
                                                                ? 'border-slate-400 bg-white text-slate-900 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/20'
                                                                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        }`}
                                                    />
                                                    <span className={`text-xs font-medium transition ${b.selected ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        uds.
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveBooksToFair}
                        disabled={saving || !selectedAuthor || selectedCount === 0}
                        className="rounded-xl bg-slate-700 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                <span>Guardando en la feria...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span>
                                    {selectedCount > 0
                                        ? `Añadir ${selectedCount} ${selectedCount === 1 ? 'libro' : 'libros'} a la feria`
                                        : 'Añadir libros a la feria'}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Dedicated Modal for Creating a New Author */}
            {showNewAuthorModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-900">
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold">
                                    <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">Crear Nuevo Autor</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNewAuthorModal(false)
                                    setNewAuthorName('')
                                    setNewAuthorError(null)
                                }}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {newAuthorError && (
                            <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-semibold">
                                {newAuthorError}
                            </div>
                        )}

                        <form
                            onSubmit={e => {
                                e.preventDefault()
                                handleCreateNewAuthor(newAuthorName)
                            }}
                            className="flex flex-col gap-3"
                        >
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Nombre completo *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nombre del autor o autora"
                                    value={newAuthorName}
                                    onChange={e => setNewAuthorName(e.target.value)}
                                    autoFocus
                                    className="h-9.5 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Se guardará en la base de datos general de autores y estará disponible en el dashboard y en todas las ferias.
                                </p>
                            </div>

                            <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowNewAuthorModal(false)
                                        setNewAuthorName('')
                                        setNewAuthorError(null)
                                    }}
                                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingAuthor || !newAuthorName.trim()}
                                    className="rounded-xl bg-slate-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                                >
                                    {creatingAuthor ? (
                                        <>
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <span>Guardar Autor</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
