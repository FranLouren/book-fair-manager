'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Book = {
    id: number
    fair_id?: number
    title: string
    author?: string | null
    isbn: string
    price?: number
    stock: number
    sold?: number
    created_at?: string
}

type Props = {
    fairId: number | string
    fairName: string
    books: Book[]
    onClose: () => void
}

type HistoryItem = {
    id: string | number
    type: 'sale' | 'stock'
    created_at: string
    book_id: number
    book_title: string
    book_author: string
    book_isbn: string
    quantity: number
    unit_price?: number
    total_price?: number
    payment_method?: 'efectivo' | 'bizum'
    movement_type?: 'initial' | 'restock' | 'adjustment' | string
    notes?: string | null
}

type SelectedFilter = {
    type: 'author' | 'book'
    value: string | number // Author name or book_id
    label: string
}

// Helper to format Date to local YYYY-MM-DD string cleanly without UTC offset shifts
function getLocalDateString(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function HistoryModal({ fairId, fairName, books, onClose }: Props) {
    const [loading, setLoading] = useState(true)
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])

    // Combobox & Filter states
    const [searchInputValue, setSearchInputValue] = useState<string>('')
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
    const [activeFilter, setActiveFilter] = useState<SelectedFilter | null>(null)

    // Secondary filters when an author is selected
    const [selectedAuthorBookId, setSelectedAuthorBookId] = useState<string>('all')

    const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'afternoon'>('all')
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'efectivo' | 'bizum' | 'sales' | 'stock'>('all')
    const [selectedDate, setSelectedDate] = useState<string>('')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState<number | 'all'>(20)

    const comboboxRef = useRef<HTMLDivElement>(null)

    // Persistent authors from authors table in Supabase
    const [persistentAuthors, setPersistentAuthors] = useState<string[]>([])

    useEffect(() => {
        async function fetchPersistentAuthors() {
            const { data } = await supabase.from('authors').select('name').order('name')
            if (data) {
                setPersistentAuthors(data.map((a: any) => a.name?.trim()).filter(Boolean))
            }
        }
        fetchPersistentAuthors()
    }, [])

    // Extract complete unique authors list (from authors table, books catalog, and sales history)
    const uniqueAuthors = Array.from(
        new Set([
            ...persistentAuthors,
            ...books.map(b => b.author?.trim()).filter((a): a is string => Boolean(a && a.length > 0)),
            ...historyItems.map(i => i.book_author?.trim()).filter((a): a is string => Boolean(a && a.length > 0)),
        ])
    ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

    // Get books published by the currently selected author
    const booksBySelectedAuthor = activeFilter && activeFilter.type === 'author'
        ? books.filter(b => b.author?.toLowerCase() === String(activeFilter.value).toLowerCase())
        : []

    async function loadHistory() {
        setLoading(true)
        const numericFairId = Number(fairId)

        // 1. Fetch sales with line items and book details (including author)
        const { data: salesData, error: salesErr } = await supabase
            .from('sales')
            .select('*, sale_items(*, books(title, author, isbn))')
            .eq('fair_id', numericFairId)
            .order('created_at', { ascending: false })

        if (salesErr) {
            console.error('Error fetching sales history:', salesErr)
        }

        // 2. Fetch stock movements (including author)
        const { data: stockData, error: stockErr } = await supabase
            .from('stock_movements')
            .select('*, books(title, author, isbn)')
            .eq('fair_id', numericFairId)
            .order('created_at', { ascending: false })

        if (stockErr) {
            console.error('Error fetching stock movements history:', stockErr)
        }

        // Combine into unified history items
        const unified: HistoryItem[] = []

        if (salesData) {
            salesData.forEach((s: any) => {
                const items = s.sale_items || []
                if (items.length > 0) {
                    items.forEach((item: any) => {
                        const unitPrice = Number(item.price_at_sale || 0)
                        const qty = Number(item.quantity || 1)
                        unified.push({
                            id: `sale-${s.id}-${item.id}`,
                            type: 'sale',
                            created_at: s.created_at,
                            book_id: item.book_id,
                            book_title: item.books?.title || `Libro #${item.book_id}`,
                            book_author: item.books?.author || '',
                            book_isbn: item.books?.isbn || '',
                            quantity: qty,
                            unit_price: unitPrice,
                            total_price: unitPrice * qty,
                            payment_method: s.payment_method,
                        })
                    })
                } else {
                    unified.push({
                        id: `sale-${s.id}`,
                        type: 'sale',
                        created_at: s.created_at,
                        book_id: 0,
                        book_title: 'Venta registrada',
                        book_author: '',
                        book_isbn: '',
                        quantity: 1,
                        unit_price: Number(s.total || 0),
                        total_price: Number(s.total || 0),
                        payment_method: s.payment_method,
                    })
                }
            })
        }

        if (stockData) {
            stockData.forEach((st: any) => {
                unified.push({
                    id: `stock-${st.id}`,
                    type: 'stock',
                    created_at: st.created_at,
                    book_id: st.book_id,
                    book_title: st.books?.title || `Libro #${st.book_id}`,
                    book_author: st.books?.author || '',
                    book_isbn: st.books?.isbn || '',
                    quantity: Number(st.quantity || 0),
                    movement_type: st.movement_type,
                    notes: st.notes || null,
                })
            })
        }

        // Sort all movements chronologically descending
        unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setHistoryItems(unified)
        setLoading(false)
    }

    useEffect(() => {
        loadHistory()
    }, [fairId])

    // Reset pagination to page 1 whenever any filter changes
    useEffect(() => {
        setCurrentPage(1)
    }, [activeFilter, selectedAuthorBookId, selectedShift, categoryFilter, selectedDate, pageSize])

    // Click outside handler to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filter matching authors for combobox
    const matchingAuthors = searchInputValue.trim()
        ? uniqueAuthors.filter(a => a.toLowerCase().includes(searchInputValue.toLowerCase()))
        : uniqueAuthors

    // Filter matching books for combobox
    const matchingBooks = searchInputValue.trim()
        ? books.filter(b =>
            b.title.toLowerCase().includes(searchInputValue.toLowerCase()) ||
            (b.author && b.author.toLowerCase().includes(searchInputValue.toLowerCase())) ||
            (b.isbn && b.isbn.toLowerCase().includes(searchInputValue.toLowerCase()))
        )
        : books

    // Base filtered items (filtered by author/book, shift, date)
    const baseFilteredItems = historyItems.filter(item => {
        // 1. Author / Book Combobox Filter
        if (activeFilter) {
            if (activeFilter.type === 'author') {
                if (item.book_author.toLowerCase() !== String(activeFilter.value).toLowerCase()) {
                    return false
                }
                if (selectedAuthorBookId !== 'all' && item.book_id !== Number(selectedAuthorBookId)) {
                    return false
                }
            } else if (activeFilter.type === 'book') {
                if (item.book_id !== Number(activeFilter.value)) {
                    return false
                }
            }
        }

        // 2. Shift Filter (Morning: 08:00–15:00, Afternoon: 15:00–23:59)
        if (selectedShift !== 'all') {
            const dt = new Date(item.created_at)
            const hours = dt.getHours()
            if (selectedShift === 'morning' && (hours < 8 || hours >= 15)) return false
            if (selectedShift === 'afternoon' && hours < 15) return false
        }

        // 3. Date Filter (using local YYYY-MM-DD helper)
        if (selectedDate) {
            const itemLocalDate = getLocalDateString(new Date(item.created_at))
            if (itemLocalDate !== selectedDate) return false
        }

        return true
    })

    // Financial KPIs based on baseFilteredItems
    const salesFiltered = baseFilteredItems.filter(i => i.type === 'sale')
    const stockFiltered = baseFilteredItems.filter(i => i.type === 'stock')
    const totalRevenue = salesFiltered.reduce((acc, curr) => acc + (curr.total_price || 0), 0)
    
    const cashSales = salesFiltered.filter(i => i.payment_method === 'efectivo')
    const cashRevenue = cashSales.reduce((acc, curr) => acc + (curr.total_price || 0), 0)
    
    const bizumSales = salesFiltered.filter(i => i.payment_method === 'bizum')
    const bizumRevenue = bizumSales.reduce((acc, curr) => acc + (curr.total_price || 0), 0)

    const totalUnitsSold = salesFiltered.reduce((acc, curr) => acc + curr.quantity, 0)
    const totalStockMovementsCount = stockFiltered.length

    // Final filtered items for table list based on selected category card
    const filteredItems = baseFilteredItems.filter(item => {
        if (categoryFilter === 'efectivo') {
            return item.type === 'sale' && item.payment_method === 'efectivo'
        }
        if (categoryFilter === 'bizum') {
            return item.type === 'sale' && item.payment_method === 'bizum'
        }
        if (categoryFilter === 'sales') {
            return item.type === 'sale'
        }
        if (categoryFilter === 'stock') {
            return item.type === 'stock'
        }
        return true
    })

    // Calculate remaining stock currently available in inventory
    const remainingStock = activeFilter
        ? activeFilter.type === 'book'
            ? (books.find(b => b.id === Number(activeFilter.value))?.stock || 0)
            : selectedAuthorBookId !== 'all'
                ? (books.find(b => b.id === Number(selectedAuthorBookId))?.stock || 0)
                : books.filter(b => b.author?.toLowerCase() === String(activeFilter.value).toLowerCase()).reduce((acc, b) => acc + (b.stock || 0), 0)
        : books.reduce((acc, b) => acc + (b.stock || 0), 0)

    function selectAuthorFilter(authorName: string) {
        setActiveFilter({
            type: 'author',
            value: authorName,
            label: `👤 Autor: ${authorName}`,
        })
        setSelectedAuthorBookId('all')
        setSearchInputValue('')
        setIsDropdownOpen(false)
    }

    function selectBookFilter(book: Book) {
        setActiveFilter({
            type: 'book',
            value: book.id,
            label: `📚 Libro: ${book.title}`,
        })
        setSelectedAuthorBookId('all')
        setSearchInputValue('')
        setIsDropdownOpen(false)
    }

    function clearActiveFilter() {
        setActiveFilter(null)
        setSelectedAuthorBookId('all')
        setSearchInputValue('')
    }

    function resetFilters() {
        setActiveFilter(null)
        setSelectedAuthorBookId('all')
        setSearchInputValue('')
        setSelectedShift('all')
        setCategoryFilter('all')
        setSelectedDate('')
        setPageSize(20)
        setCurrentPage(1)
    }

    // Pagination calculations
    const numericPageSize = pageSize === 'all' ? filteredItems.length : Number(pageSize)
    const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredItems.length / numericPageSize))
    const validCurrentPage = Math.min(currentPage, totalPages)
    const startIndex = pageSize === 'all' ? 0 : (validCurrentPage - 1) * numericPageSize
    const endIndex = pageSize === 'all' ? filteredItems.length : Math.min(startIndex + numericPageSize, filteredItems.length)
    const paginatedItems = pageSize === 'all' ? filteredItems : filteredItems.slice(startIndex, endIndex)

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-900 overflow-hidden p-3 sm:p-5 font-sans">
            {/* Top Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <span>📜</span> Historial
                    </h2>
                    <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs font-bold text-slate-800 border border-slate-300">
                        {fairName}
                    </span>
                </div>
                <button
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-xs"
                    title="Restablecer todos los filtros"
                >
                    <span>🔄</span> Limpiar Filtros
                </button>
            </div>

            {/* Filter Toolbar */}
            <div className="my-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Combobox Search & Select Input */}
                    <div ref={comboboxRef} className="relative flex flex-col justify-between">
                        <label className="mb-1 block text-xs font-bold text-slate-700">
                            🔍 Título, autor o ISBN
                        </label>

                        {activeFilter ? (
                            <div className="flex flex-col gap-1.5">
                                {/* Active selection badge */}
                                <div className="flex items-center justify-between h-9 rounded-xl bg-slate-100 px-3 border border-slate-300">
                                    <span className="text-xs font-bold text-slate-900 truncate">{activeFilter.label}</span>
                                    <button
                                        onClick={clearActiveFilter}
                                        className="ml-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
                                        title="Quitar filtro"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Secondary Book Selector if filtering by Author */}
                                {activeFilter.type === 'author' && booksBySelectedAuthor.length > 0 && (
                                    <select
                                        value={selectedAuthorBookId}
                                        onChange={e => setSelectedAuthorBookId(e.target.value)}
                                        className="w-full h-8 rounded-lg bg-[#fafafa] px-2.5 text-xs font-bold text-slate-900 border border-slate-300 outline-none cursor-pointer"
                                    >
                                        <option value="all">📚 Todos los libros del autor ({booksBySelectedAuthor.length})</option>
                                        {booksBySelectedAuthor.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.title} (Stock: {b.stock})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ) : (
                            /* Search input */
                            <div>
                                <input
                                    type="text"
                                    placeholder="Buscar por título, autor o ISBN..."
                                    value={searchInputValue}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onChange={e => {
                                        setSearchInputValue(e.target.value)
                                        setIsDropdownOpen(true)
                                    }}
                                    className="w-full h-9 rounded-xl bg-[#fafafa] px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none border border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10 transition"
                                />

                                {/* Auto-suggest Floating Options Dropdown */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-12 z-50 max-h-64 overflow-y-auto rounded-xl border border-slate-300 bg-white p-2 shadow-xl">
                                        {/* Section 1: Authors matching */}
                                        {matchingAuthors.length > 0 && (
                                            <div className="mb-2">
                                                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    👤 Autores sugeridos ({matchingAuthors.length})
                                                </div>
                                                {matchingAuthors.map(author => (
                                                    <button
                                                        key={`author-${author}`}
                                                        type="button"
                                                        onClick={() => selectAuthorFilter(author)}
                                                        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-slate-100 text-left transition"
                                                    >
                                                        <span>👤 Todos los libros de: <strong>{author}</strong></span>
                                                        <span className="text-[10px] text-slate-500">Ver autor</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Section 2: Books matching */}
                                        {matchingBooks.length > 0 && (
                                            <div>
                                                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    📚 Libros ({matchingBooks.length})
                                                </div>
                                                {matchingBooks.map(b => (
                                                    <button
                                                        key={`book-${b.id}`}
                                                        type="button"
                                                        onClick={() => selectBookFilter(b)}
                                                        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 text-left transition"
                                                    >
                                                        <div>
                                                            <span className="font-bold">{b.title}</span>
                                                            {b.author && <span className="text-[10px] text-slate-500 block">{b.author}</span>}
                                                        </div>
                                                        <span className="text-[10px] text-amber-800 font-bold">Stock: {b.stock}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {matchingAuthors.length === 0 && matchingBooks.length === 0 && (
                                            <div className="p-3 text-center text-xs text-slate-500 font-medium">
                                                No se encontraron autores o libros que coincidan con &quot;{searchInputValue}&quot;
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Shift Selector */}
                    <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">🕒 Turno</label>
                        <select
                            value={selectedShift}
                            onChange={e => setSelectedShift(e.target.value as any)}
                            className="w-full h-9 rounded-xl bg-[#fafafa] px-3 text-sm font-medium text-slate-900 outline-none border border-slate-300 focus:border-slate-800"
                        >
                            <option value="all">Todos los turnos</option>
                            <option value="morning">☀️ Mañana (08:00 - 15:00)</option>
                            <option value="afternoon">🌙 Tarde (15:00 - 23:59)</option>
                        </select>
                    </div>

                    {/* Date Picker */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700">🗓️ Fecha</label>
                            {selectedDate && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate('')}
                                    className="text-[10px] font-bold text-slate-700 hover:underline"
                                >
                                    Ver todas
                                </button>
                            )}
                        </div>
                        <div className="flex gap-1.5">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="flex-1 h-9 rounded-xl bg-[#fafafa] px-3 text-sm font-medium text-slate-900 outline-none border border-slate-300 focus:border-slate-800"
                            />
                            <button
                                type="button"
                                onClick={() => setSelectedDate(getLocalDateString(new Date()))}
                                className="h-9 rounded-xl border border-slate-300 bg-slate-100 px-3 text-xs font-bold text-slate-800 hover:bg-slate-200 transition"
                            >
                                Hoy
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive KPI Filter Cards */}
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* Total Recaudado (Card 1: Ver Todo) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-xs cursor-pointer ${
                        categoryFilter === 'all'
                            ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total Recaudado</span>
                        {categoryFilter === 'all' && (
                            <span className="rounded-full bg-emerald-700 px-1.5 py-0.2 text-[9px] font-extrabold text-white">✓ Todos</span>
                        )}
                    </div>
                    <div className="text-xl font-extrabold text-emerald-800 leading-tight mt-1">
                        {totalRevenue.toFixed(2)} €
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium mt-0.5">{salesFiltered.length} ventas</span>
                </button>

                {/* Cash Balance (Card 2: Solo Efectivo) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'efectivo' ? 'all' : 'efectivo')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-xs cursor-pointer ${
                        categoryFilter === 'efectivo'
                            ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30'
                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">💵 Efectivo</span>
                        <span className={`rounded px-1.5 text-[10px] font-extrabold ${categoryFilter === 'efectivo' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                            {totalRevenue > 0 ? ((cashRevenue / totalRevenue) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div className="text-lg font-extrabold text-slate-900 leading-tight mt-1">
                        {cashRevenue.toFixed(2)} €
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {cashSales.length} cobros {categoryFilter === 'efectivo' ? '(filtrado)' : ''}
                    </span>
                </button>

                {/* Bizum Balance (Card 3: Solo Bizum) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'bizum' ? 'all' : 'bizum')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-xs cursor-pointer ${
                        categoryFilter === 'bizum'
                            ? 'border-slate-900 bg-slate-900 text-white ring-2 ring-slate-800/30'
                            : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${categoryFilter === 'bizum' ? 'text-slate-200' : 'text-slate-700'}`}>📲 Bizum</span>
                        <span className={`rounded px-1.5 text-[10px] font-extrabold ${categoryFilter === 'bizum' ? 'bg-white text-slate-900' : 'bg-slate-200 text-slate-900'}`}>
                            {totalRevenue > 0 ? ((bizumRevenue / totalRevenue) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div className={`text-lg font-extrabold leading-tight mt-1 ${categoryFilter === 'bizum' ? 'text-white' : 'text-slate-900'}`}>
                        {bizumRevenue.toFixed(2)} €
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${categoryFilter === 'bizum' ? 'text-slate-300' : 'text-slate-500'}`}>
                        {bizumSales.length} cobros {categoryFilter === 'bizum' ? '(filtrado)' : ''}
                    </span>
                </button>

                {/* Volume summary (Card 4: Solo Ventas) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'sales' ? 'all' : 'sales')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-xs cursor-pointer ${
                        categoryFilter === 'sales'
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/30'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">📚 Libros Vendidos</span>
                        {categoryFilter === 'sales' && (
                            <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[9px] font-extrabold text-white">✓ Ventas</span>
                        )}
                    </div>
                    <div className="text-lg font-extrabold text-slate-900 leading-tight mt-1">
                        {totalUnitsSold} <span className="text-xs font-medium text-slate-500">uds.</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                        {salesFiltered.length} ventas {categoryFilter === 'sales' ? '(filtrado)' : ''}
                    </span>
                </button>

                {/* Stock Restante & Reposiciones (Card 5: Solo Stock) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'stock' ? 'all' : 'stock')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-xs cursor-pointer ${
                        categoryFilter === 'stock'
                            ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-500/30'
                            : 'border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:bg-amber-100/50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">📦 Stock Restante</span>
                        {categoryFilter === 'stock' && (
                            <span className="rounded-full bg-amber-700 px-1.5 py-0.2 text-[9px] font-extrabold text-white">✓ Movimientos</span>
                        )}
                    </div>
                    <div className="text-xl font-extrabold text-amber-900 leading-tight mt-1">
                        {remainingStock} <span className="text-xs font-normal text-amber-800">uds.</span>
                    </div>
                    <span className="text-[10px] text-amber-800 font-medium truncate mt-0.5">
                        {totalStockMovementsCount} mov. {categoryFilter === 'stock' ? '(filtrado)' : ''}
                    </span>
                </button>
            </div>

            {/* Main Expanded Table Area */}
            <div className="flex-1 overflow-hidden flex flex-col rounded-xl border border-slate-200 bg-[#fafafa] shadow-xs">
                <div className="flex-1 overflow-y-auto p-2 sm:p-3">
                    {loading ? (
                        <div className="py-16 text-center text-base text-slate-500 font-medium">Cargando historial de movimientos...</div>
                    ) : paginatedItems.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-lg font-bold text-slate-900">
                                {activeFilter ? `No se encontraron movimientos para ${activeFilter.label}` : 'No se encontraron movimientos con estos filtros'}
                            </p>
                            <button
                                onClick={resetFilters}
                                className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-xs"
                            >
                                Limpiar Filtros y Ver Todo
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-sm text-slate-900">
                                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
                                    <tr>
                                        <th className="px-4 py-3">Fecha y Hora</th>
                                        <th className="px-4 py-3">Libro / Autor</th>
                                        <th className="px-4 py-3">Operación</th>
                                        <th className="px-4 py-3 text-center">Unidades</th>
                                        <th className="px-4 py-3 text-right">Importe</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedItems.map(item => {
                                        const dt = new Date(item.created_at)
                                        const dateStr = dt.toLocaleDateString('es-ES', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                        })
                                        const timeStr = dt.toLocaleTimeString('es-ES', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                        })

                                        return (
                                            <tr key={item.id} className="transition hover:bg-slate-50">
                                                {/* Date & Time */}
                                                <td className="px-4 py-3 font-mono whitespace-nowrap">
                                                    <span className="text-slate-900 font-bold text-sm">{dateStr}</span>{' '}
                                                    <span className="text-emerald-700 font-bold text-sm ml-1">{timeStr}</span>
                                                </td>

                                                {/* Book Title & Author & ISBN */}
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-900 text-sm">{item.book_title}</div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-0.5 font-medium">
                                                        {item.book_author && (
                                                            <span>Autor: <strong className="text-slate-800">{item.book_author}</strong></span>
                                                        )}
                                                        {item.book_isbn && (
                                                            <span className="font-mono">ISBN: {item.book_isbn}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Operation Badge */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col items-start gap-1">
                                                        {item.type === 'sale' ? (
                                                            item.payment_method === 'efectivo' ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 font-bold text-emerald-900 border border-emerald-300 text-xs">
                                                                    💵 Venta en Efectivo
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1 font-bold text-slate-900 border border-slate-300 text-xs">
                                                                    📲 Venta por Bizum
                                                                </span>
                                                            )
                                                        ) : item.movement_type === 'initial' ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 font-bold text-amber-900 border border-amber-300 text-xs">
                                                                📦 Stock Inicial
                                                            </span>
                                                        ) : item.movement_type === 'adjustment' || item.quantity < 0 ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 font-bold text-rose-900 border border-rose-300 text-xs" title={item.notes ? `Motivo: ${item.notes}` : undefined}>
                                                                🔻 Retirada de Stock
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 px-2.5 py-1 font-bold text-blue-900 border border-blue-300 text-xs" title={item.notes ? `Nota: ${item.notes}` : undefined}>
                                                                🔄 Reposición de Stock
                                                            </span>
                                                        )}

                                                        {item.notes && (
                                                            <span className="text-[11px] font-medium text-slate-600 block max-w-[220px] truncate leading-tight" title={item.notes}>
                                                                &quot;{item.notes}&quot;
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Quantity */}
                                                <td className="px-4 py-3 text-center">
                                                    {item.type === 'sale' ? (
                                                        <span className="rounded-md bg-red-100 px-2.5 py-0.5 font-extrabold text-red-700 text-xs border border-red-200">
                                                            -{item.quantity} ud.
                                                        </span>
                                                    ) : item.quantity < 0 ? (
                                                        <span className="rounded-md bg-rose-100 px-2.5 py-0.5 font-extrabold text-rose-700 text-xs border border-rose-200">
                                                            {item.quantity} ud.
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-md bg-emerald-100 px-2.5 py-0.5 font-extrabold text-emerald-800 text-xs border border-emerald-200">
                                                            +{item.quantity} ud.
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Price / Total */}
                                                <td className="px-4 py-3 text-right font-black font-mono text-base">
                                                    {item.type === 'sale' ? (
                                                        <span className="text-emerald-700">
                                                            +{item.total_price?.toFixed(2)} €
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Modal Footer Bar with Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-3">
                    {/* Left: Item count text */}
                    <div className="sm:w-1/3 text-left">
                        <span className="text-xs font-bold text-slate-600">
                            Mostrando <strong className="text-slate-900">{filteredItems.length > 0 ? startIndex + 1 : 0}-{endIndex}</strong> de <strong className="text-slate-900">{filteredItems.length}</strong> movimientos
                        </span>
                    </div>

                    {/* Center: Pagination Controls */}
                    <div className="sm:w-1/3 flex items-center justify-center gap-4">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="font-bold">Mostrar:</span>
                            <select
                                value={pageSize}
                                onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="rounded-xl bg-[#fafafa] px-3 py-1 text-xs font-bold text-slate-900 border border-slate-300 outline-none cursor-pointer"
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value="all">Todos ({filteredItems.length})</option>
                            </select>
                        </div>

                        {/* Prev / Next Page Buttons */}
                        {pageSize !== 'all' && totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={validCurrentPage <= 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 transition disabled:opacity-30"
                                    title="Página anterior"
                                >
                                    ←
                                </button>
                                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                                    {validCurrentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={validCurrentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 transition disabled:opacity-30"
                                    title="Página siguiente"
                                >
                                    →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Close Button */}
                    <div className="sm:w-1/3 text-right">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                        >
                            Cerrar Historial
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
