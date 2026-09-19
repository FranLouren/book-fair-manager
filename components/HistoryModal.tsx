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
    movement_type?: 'initial' | 'restock'
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

    const [selectedShift, setSelectedShift] = useState<'all' | 'morning' | 'afternoon'>('all')
    const [selectedPayment, setSelectedPayment] = useState<'all' | 'efectivo' | 'bizum'>('all')
    const [selectedMovementType, setSelectedMovementType] = useState<'all' | 'sales' | 'stock'>('all')
    const [selectedDate, setSelectedDate] = useState<string>('')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState<number | 'all'>(20)

    const comboboxRef = useRef<HTMLDivElement>(null)

    // Extract unique authors list from books catalog
    const uniqueAuthors = Array.from(
        new Set(
            books
                .map(b => b.author?.trim())
                .filter((a): a is string => Boolean(a && a.length > 0))
        )
    ).sort()

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
            stockData.forEach((m: any) => {
                unified.push({
                    id: `stock-${m.id}`,
                    type: 'stock',
                    created_at: m.created_at,
                    book_id: m.book_id,
                    book_title: m.books?.title || `Libro #${m.book_id}`,
                    book_author: m.books?.author || '',
                    book_isbn: m.books?.isbn || '',
                    quantity: m.quantity,
                    movement_type: m.movement_type,
                })
            })
        }

        // Sort descending by timestamp
        unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setHistoryItems(unified)
        setLoading(false)
    }

    useEffect(() => {
        loadHistory()
    }, [fairId])

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Reset pagination to page 1 whenever any filter changes
    useEffect(() => {
        setCurrentPage(1)
    }, [activeFilter, selectedShift, selectedPayment, selectedMovementType, selectedDate, pageSize])

    // Autocomplete matching options
    const query = searchInputValue.toLowerCase().trim()
    
    const matchingAuthors = uniqueAuthors.filter(author =>
        author.toLowerCase().includes(query)
    )

    const matchingBooks = books.filter(book =>
        book.title.toLowerCase().includes(query) ||
        (book.isbn && book.isbn.toLowerCase().includes(query)) ||
        (book.author && book.author.toLowerCase().includes(query))
    )

    // Filter history logic
    const filteredItems = historyItems.filter(item => {
        // Active Combobox Filter (author vs book)
        if (activeFilter) {
            if (activeFilter.type === 'author') {
                if (item.book_author.toLowerCase() !== String(activeFilter.value).toLowerCase()) {
                    return false
                }
            } else if (activeFilter.type === 'book') {
                if (item.book_id !== Number(activeFilter.value)) {
                    return false
                }
            }
        }

        // Payment method filter
        if (selectedPayment !== 'all') {
            if (item.type !== 'sale' || item.payment_method !== selectedPayment) {
                return false
            }
        }

        // Movement type filter
        if (selectedMovementType === 'sales' && item.type !== 'sale') return false
        if (selectedMovementType === 'stock' && item.type !== 'stock') return false

        // Date filter (Local Date)
        const itemDate = new Date(item.created_at)
        const hour = itemDate.getHours()

        if (selectedDate) {
            const itemDateStr = getLocalDateString(itemDate)
            if (itemDateStr !== selectedDate) return false
        }

        // Shift filter (Mañana vs Tarde)
        if (selectedShift === 'morning') {
            if (hour < 8 || hour >= 15) return false
        } else if (selectedShift === 'afternoon') {
            if (hour < 15) return false
        }

        return true
    })

    // Financial KPIs based on ALL filtered items
    const salesFiltered = filteredItems.filter(i => i.type === 'sale')
    const stockFiltered = filteredItems.filter(i => i.type === 'stock')

    const totalRevenue = salesFiltered.reduce((acc, curr) => acc + (curr.total_price || 0), 0)
    
    const cashSales = salesFiltered.filter(i => i.payment_method === 'efectivo')
    const cashRevenue = cashSales.reduce((acc, curr) => acc + (curr.total_price || 0), 0)
    
    const bizumSales = salesFiltered.filter(i => i.payment_method === 'bizum')
    const bizumRevenue = bizumSales.reduce((acc, curr) => acc + (curr.total_price || 0), 0)

    const totalUnitsSold = salesFiltered.reduce((acc, curr) => acc + curr.quantity, 0)

    // Calculate remaining stock currently available in inventory
    const remainingStock = activeFilter
        ? activeFilter.type === 'book'
            ? (books.find(b => b.id === Number(activeFilter.value))?.stock || 0)
            : books.filter(b => b.author?.toLowerCase() === String(activeFilter.value).toLowerCase()).reduce((acc, b) => acc + (b.stock || 0), 0)
        : books.reduce((acc, b) => acc + (b.stock || 0), 0)

    function selectAuthorFilter(authorName: string) {
        setActiveFilter({
            type: 'author',
            value: authorName,
            label: `👤 Autor: ${authorName}`,
        })
        setSearchInputValue('')
        setIsDropdownOpen(false)
    }

    function selectBookFilter(book: Book) {
        setActiveFilter({
            type: 'book',
            value: book.id,
            label: `📚 Libro: ${book.title}`,
        })
        setSearchInputValue('')
        setIsDropdownOpen(false)
    }

    function clearActiveFilter() {
        setActiveFilter(null)
        setSearchInputValue('')
    }

    function resetFilters() {
        setActiveFilter(null)
        setSearchInputValue('')
        setSelectedShift('all')
        setSelectedPayment('all')
        setSelectedMovementType('all')
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
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a] text-white overflow-hidden p-3 sm:p-5">
            {/* Ultra Compact Top Header */}
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
                        <span>📜</span> Historial
                    </h2>
                    <span className="rounded-full bg-[#6366f1]/20 px-3 py-0.5 text-xs font-bold text-[#a5b4fc] border border-[#6366f1]/30">
                        {fairName}
                    </span>
                </div>
                <button
                    onClick={resetFilters}
                    className="flex items-center gap-1.5 rounded-xl border border-[#6366f1]/40 bg-[#6366f1]/20 px-4 py-2 text-xs font-bold text-[#a5b4fc] hover:bg-[#6366f1] hover:text-white transition shadow-md"
                    title="Restablecer todos los filtros"
                >
                    <span>🔄</span> Limpiar Filtros
                </button>
            </div>

            {/* Filter Toolbar with Interactive Combobox Selection */}
            <div className="my-2.5 rounded-xl border border-[#334155] bg-[#1e293b] p-3 shadow-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* Combobox Search & Select Input (Author or Book) */}
                    <div ref={comboboxRef} className="relative">
                        <label className="mb-1 block text-xs font-bold text-[#94a3b8]">
                            🔍 Título, autor o ISBN
                        </label>

                        {activeFilter ? (
                            /* Active selection badge */
                            <div className="flex items-center justify-between h-9 rounded-lg bg-[#6366f1]/20 px-3 border border-[#6366f1]/40">
                                <span className="text-xs font-bold text-white truncate">{activeFilter.label}</span>
                                <button
                                    onClick={clearActiveFilter}
                                    className="ml-2 text-xs text-[#a5b4fc] hover:text-white font-bold"
                                    title="Quitar filtro"
                                >
                                    ✕
                                </button>
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
                                    className="w-full h-9 rounded-lg bg-[#0f172a] px-3 text-sm font-medium text-white placeholder-[#64748b] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1] transition"
                                />

                                {/* Auto-suggest Floating Options Dropdown */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-12 z-50 max-h-64 overflow-y-auto rounded-xl border border-[#334155] bg-[#0f172a] p-2 shadow-2xl">
                                        {/* Section 1: Authors matching */}
                                        {matchingAuthors.length > 0 && (
                                            <div className="mb-2">
                                                <div className="px-2 py-1 text-[10px] font-black text-[#94a3b8] uppercase tracking-wider">
                                                    👤 Autores sugeridos ({matchingAuthors.length})
                                                </div>
                                                {matchingAuthors.map(author => (
                                                    <button
                                                        key={`author-${author}`}
                                                        type="button"
                                                        onClick={() => selectAuthorFilter(author)}
                                                        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-[#1e293b] text-left transition"
                                                    >
                                                        <span>👤 Todos los libros de: <strong>{author}</strong></span>
                                                        <span className="text-[10px] text-[#94a3b8]">Ver autor</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Section 2: Books matching */}
                                        {matchingBooks.length > 0 && (
                                            <div>
                                                <div className="px-2 py-1 text-[10px] font-black text-[#94a3b8] uppercase tracking-wider">
                                                    📚 Libros ({matchingBooks.length})
                                                </div>
                                                {matchingBooks.map(b => (
                                                    <button
                                                        key={`book-${b.id}`}
                                                        type="button"
                                                        onClick={() => selectBookFilter(b)}
                                                        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-medium text-white hover:bg-[#1e293b] text-left transition"
                                                    >
                                                        <div>
                                                            <span className="font-bold">{b.title}</span>
                                                            {b.author && <span className="text-[10px] text-[#94a3b8] block">{b.author}</span>}
                                                        </div>
                                                        <span className="text-[10px] text-amber-400 font-bold">Stock: {b.stock}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {matchingAuthors.length === 0 && matchingBooks.length === 0 && (
                                            <div className="p-3 text-center text-xs text-[#94a3b8]">
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
                        <label className="mb-1 block text-xs font-bold text-[#94a3b8]">🕒 Turno</label>
                        <select
                            value={selectedShift}
                            onChange={e => setSelectedShift(e.target.value as any)}
                            className="w-full h-9 rounded-lg bg-[#0f172a] px-3 text-sm font-medium text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        >
                            <option value="all">Todos los turnos</option>
                            <option value="morning">☀️ Mañana (08:00 - 15:00)</option>
                            <option value="afternoon">🌙 Tarde (15:00 - 23:59)</option>
                        </select>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                        <label className="mb-1 block text-xs font-bold text-[#94a3b8]">💳 Método Pago</label>
                        <select
                            value={selectedPayment}
                            onChange={e => setSelectedPayment(e.target.value as any)}
                            className="w-full h-9 rounded-lg bg-[#0f172a] px-3 text-sm font-medium text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        >
                            <option value="all">Todos los métodos</option>
                            <option value="efectivo">💵 Solo Efectivo</option>
                            <option value="bizum">📲 Solo Bizum</option>
                        </select>
                    </div>

                    {/* Date Picker */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-[#94a3b8]">🗓️ Fecha</label>
                            {selectedDate && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate('')}
                                    className="text-[10px] font-semibold text-[#818cf8] hover:underline"
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
                                className="flex-1 h-9 rounded-lg bg-[#0f172a] px-3 text-sm font-medium text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                            <button
                                type="button"
                                onClick={() => setSelectedDate(getLocalDateString(new Date()))}
                                className="h-9 rounded-lg border border-[#334155] bg-[#0f172a] px-3 text-xs font-bold text-[#cbd5e1] hover:text-white hover:bg-[#334155] transition"
                            >
                                Hoy
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Streamlined Compact KPI Banner */}
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* Total Recaudado */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Total Recaudado</span>
                    <div className="text-xl font-black text-emerald-400 leading-tight">
                        {totalRevenue.toFixed(2)} €
                    </div>
                    <span className="text-[10px] text-emerald-300/70">{salesFiltered.length} ventas</span>
                </div>

                {/* Cash Balance */}
                <div className="rounded-xl border border-emerald-600/30 bg-[#1e293b] px-3.5 py-2 flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">💵 Efectivo</span>
                        <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] font-black text-emerald-400">
                            {totalRevenue > 0 ? ((cashRevenue / totalRevenue) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div className="text-lg font-black text-white leading-tight">
                        {cashRevenue.toFixed(2)} €
                    </div>
                    <span className="text-[10px] text-[#94a3b8]">{cashSales.length} cobros</span>
                </div>

                {/* Bizum Balance */}
                <div className="rounded-xl border border-[#6366f1]/40 bg-[#1e293b] px-3.5 py-2 flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">📲 Bizum</span>
                        <span className="rounded bg-[#6366f1]/20 px-1.5 text-[10px] font-black text-[#a5b4fc]">
                            {totalRevenue > 0 ? ((bizumRevenue / totalRevenue) * 100).toFixed(0) : 0}%
                        </span>
                    </div>
                    <div className="text-lg font-black text-white leading-tight">
                        {bizumRevenue.toFixed(2)} €
                    </div>
                    <span className="text-[10px] text-[#94a3b8]">{bizumSales.length} cobros</span>
                </div>

                {/* Volume summary */}
                <div className="rounded-xl border border-[#334155] bg-[#1e293b] px-3.5 py-2 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">📚 Libros Vendidos</span>
                    <div className="text-lg font-black text-white leading-tight">
                        {totalUnitsSold} <span className="text-xs font-semibold text-[#94a3b8]">uds.</span>
                    </div>
                    <span className="text-[10px] text-[#94a3b8]">en el periodo</span>
                </div>

                {/* Stock Restante Actual */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">📦 Stock Restante</span>
                    <div className="text-xl font-black text-amber-400 leading-tight">
                        {remainingStock} <span className="text-xs font-normal text-amber-200">uds.</span>
                    </div>
                    <span className="text-[10px] text-amber-300/70 truncate">
                        {activeFilter ? activeFilter.label : 'en stand'}
                    </span>
                </div>
            </div>

            {/* Main Expanded Table Area - Takes max height */}
            <div className="flex-1 overflow-hidden flex flex-col rounded-xl border border-[#334155] bg-[#1e293b] shadow-xl">
                <div className="flex-1 overflow-y-auto p-2 sm:p-3">
                    {loading ? (
                        <div className="py-16 text-center text-base text-[#94a3b8]">Cargando historial de movimientos...</div>
                    ) : paginatedItems.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-lg font-bold text-white">
                                {activeFilter ? `No se encontraron movimientos para ${activeFilter.label}` : 'No se encontraron movimientos con estos filtros'}
                            </p>
                            <button
                                onClick={resetFilters}
                                className="mt-4 rounded-xl bg-[#6366f1] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4f46e5] transition shadow-md"
                            >
                                Limpiar Filtros y Ver Todo
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-[#334155]">
                            <table className="w-full text-left text-sm text-white">
                                <thead className="sticky top-0 z-10 border-b border-[#334155] bg-[#0f172a] text-xs font-black uppercase tracking-wider text-[#94a3b8]">
                                    <tr>
                                        <th className="px-4 py-2.5">Fecha y Hora</th>
                                        <th className="px-4 py-2.5">Libro / Autor</th>
                                        <th className="px-4 py-2.5">Operación</th>
                                        <th className="px-4 py-2.5 text-center">Unidades</th>
                                        <th className="px-4 py-2.5 text-right">Importe</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#334155]">
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
                                            <tr key={item.id} className="transition hover:bg-[#0f172a]/70">
                                                {/* Date & Time */}
                                                <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                                                    <span className="text-white font-bold text-sm">{dateStr}</span>{' '}
                                                    <span className="text-emerald-400 font-bold text-sm ml-1">{timeStr}</span>
                                                </td>

                                                {/* Book Title & Author & ISBN */}
                                                <td className="px-4 py-2.5">
                                                    <div className="font-bold text-white text-sm">{item.book_title}</div>
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#94a3b8] mt-0.5">
                                                        {item.book_author && (
                                                            <span>Autor: <strong className="text-white">{item.book_author}</strong></span>
                                                        )}
                                                        {item.book_isbn && (
                                                            <span className="font-mono">ISBN: {item.book_isbn}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Operation Badge */}
                                                <td className="px-4 py-2.5">
                                                    {item.type === 'sale' ? (
                                                        item.payment_method === 'efectivo' ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 font-extrabold text-emerald-400 border border-emerald-500/30 text-xs">
                                                                💵 Venta en Efectivo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#6366f1]/20 px-2.5 py-1 font-extrabold text-[#a5b4fc] border border-[#6366f1]/40 text-xs">
                                                                📲 Venta por Bizum
                                                            </span>
                                                        )
                                                    ) : item.movement_type === 'initial' ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 font-bold text-amber-300 border border-amber-500/30 text-xs">
                                                            📦 Stock Inicial
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-2.5 py-1 font-bold text-blue-300 border border-blue-500/30 text-xs">
                                                            🔄 Reposición de Stock
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Quantity */}
                                                <td className="px-4 py-2.5 text-center">
                                                    {item.type === 'sale' ? (
                                                        <span className="rounded-md bg-red-500/20 px-2.5 py-0.5 font-black text-red-400 text-xs">
                                                            -{item.quantity} ud.
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 font-black text-emerald-400 text-xs">
                                                            +{item.quantity} ud.
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Price / Total */}
                                                <td className="px-4 py-2.5 text-right font-black font-mono text-base">
                                                    {item.type === 'sale' ? (
                                                        <span className="text-emerald-400">
                                                            +{item.total_price?.toFixed(2)} €
                                                        </span>
                                                    ) : (
                                                        <span className="text-[#94a3b8]">-</span>
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#334155] bg-[#0f172a] px-4 py-2.5">
                    {/* Item count text */}
                    <span className="text-xs font-semibold text-[#cbd5e1]">
                        Mostrando <strong className="text-white">{filteredItems.length > 0 ? startIndex + 1 : 0}</strong> a <strong className="text-white">{endIndex}</strong> de <strong className="text-white">{filteredItems.length}</strong> movimientos
                    </span>

                    {/* Pagination Page Size and Navigation Controls */}
                    <div className="flex items-center gap-4">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-[#cbd5e1]">
                            <span className="font-medium">Mostrar:</span>
                            <select
                                value={pageSize}
                                onChange={e => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="rounded-lg bg-[#1e293b] px-2.5 py-1 text-xs font-bold text-white border border-[#334155] outline-none"
                            >
                                <option value={20}>20 por pág.</option>
                                <option value={50}>50 por pág.</option>
                                <option value={100}>100 por pág.</option>
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
                                    className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1 text-xs font-bold text-white hover:bg-[#334155] transition disabled:opacity-30 disabled:hover:bg-[#1e293b]"
                                >
                                    ← Anterior
                                </button>
                                <span className="text-xs font-bold text-white whitespace-nowrap">
                                    Pág. {validCurrentPage} de {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={validCurrentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1 text-xs font-bold text-white hover:bg-[#334155] transition disabled:opacity-30 disabled:hover:bg-[#1e293b]"
                                >
                                    Siguiente →
                                </button>
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg bg-[#334155] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#475569] transition ml-2"
                        >
                            Cerrar Historial
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
