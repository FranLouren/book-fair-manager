'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

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
    onUpdated?: () => void
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
    sale_id?: number
    sale_item_id?: number
    stock_movement_id?: number
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

export default function HistoryModal({ fairId, fairName, books, onClose, onUpdated }: Props) {
    const [loading, setLoading] = useState(true)
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])

    // Undo transaction state
    const [undoingItem, setUndoingItem] = useState<HistoryItem | null>(null)
    const [isUndoing, setIsUndoing] = useState(false)
    const [undoError, setUndoError] = useState<string | null>(null)

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
                            sale_id: s.id,
                            sale_item_id: item.id,
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
                        sale_id: s.id,
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
                    stock_movement_id: st.id,
                })
            })
        }

        // Sort all movements chronologically descending
        unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setHistoryItems(unified)
        setLoading(false)
    }

    // Check if a stock movement is blocked from being undone because units have already been sold
    function getUndoRestriction(item: HistoryItem): string | null {
        if (item.type !== 'stock') return null

        const soldUnits = historyItems
            .filter(h => h.type === 'sale' && h.book_id === item.book_id)
            .reduce((acc, h) => acc + h.quantity, 0)

        // 1. Stock inicial: no se puede borrar si ya existen ventas de este libro
        if (item.movement_type === 'initial' && soldUnits > 0) {
            return `Bloqueado: ya hay ${soldUnits} ${soldUnits === 1 ? 'unidad vendida' : 'unidades vendidas'} de este libro.`
        }

        // 2. Entradas positivas de stock (reposición o inicial): no se puede deshacer si el stock actual es menor que lo añadido
        if (item.quantity > 0) {
            const book = books.find(b => b.id === item.book_id)
            const currentStock = book ? book.stock : 0
            if (currentStock < item.quantity) {
                return `Bloqueado: solo quedan ${currentStock} ud. en stock (ya se vendieron unidades de esta entrada).`
            }
        }

        return null
    }

    async function handleConfirmUndo() {
        if (!undoingItem) return
        setIsUndoing(true)
        setUndoError(null)

        try {
            if (undoingItem.type === 'sale') {
                // 1. Delete sale_item first (or sale if legacy)
                if (undoingItem.sale_item_id) {
                    const { data: deletedItem, error: itemErr } = await supabase
                        .from('sale_items')
                        .delete()
                        .eq('id', undoingItem.sale_item_id)
                        .select()

                    if (itemErr) {
                        throw new Error('Error al anular venta: ' + itemErr.message)
                    }
                    if (!deletedItem || deletedItem.length === 0) {
                        throw new Error('Supabase bloqueó el borrado (comprueba permisos DELETE en sale_items).')
                    }
                } else if (undoingItem.sale_id) {
                    const { data: deletedSale, error: saleErr } = await supabase
                        .from('sales')
                        .delete()
                        .eq('id', undoingItem.sale_id)
                        .select()

                    if (saleErr) {
                        throw new Error('Error al anular venta: ' + saleErr.message)
                    }
                    if (!deletedSale || deletedSale.length === 0) {
                        throw new Error('Supabase bloqueó el borrado (comprueba permisos DELETE en sales).')
                    }
                }

                // 2. Restore book stock
                if (undoingItem.book_id > 0) {
                    const { data: currentBook } = await supabase
                        .from('books')
                        .select('stock')
                        .eq('id', undoingItem.book_id)
                        .single()

                    const curStock = currentBook ? Number(currentBook.stock) : 0
                    const restoredStock = curStock + undoingItem.quantity
                    const { error: stockErr } = await supabase
                        .from('books')
                        .update({ stock: restoredStock })
                        .eq('id', undoingItem.book_id)

                    if (stockErr) {
                        console.error('Error restoring stock:', stockErr)
                    }
                }

                // 3. Update or delete parent sale if sale_item_id existed
                if (undoingItem.sale_item_id && undoingItem.sale_id) {
                    const { data: remainingItems } = await supabase
                        .from('sale_items')
                        .select('id, price_at_sale, quantity')
                        .eq('sale_id', undoingItem.sale_id)

                    if (!remainingItems || remainingItems.length === 0) {
                        await supabase
                            .from('sales')
                            .delete()
                            .eq('id', undoingItem.sale_id)
                    } else {
                        const newTotal = remainingItems.reduce(
                            (acc, it) => acc + Number(it.price_at_sale || 0) * Number(it.quantity || 1),
                            0
                        )
                        await supabase
                            .from('sales')
                            .update({ total: parseFloat(newTotal.toFixed(2)) })
                            .eq('id', undoingItem.sale_id)
                    }
                }
            } else if (undoingItem.type === 'stock') {
                // 0. Live validation before deleting
                const restriction = getUndoRestriction(undoingItem)
                if (restriction) {
                    throw new Error(restriction)
                }

                let curStock = 0
                if (undoingItem.book_id > 0) {
                    const { data: currentBook } = await supabase
                        .from('books')
                        .select('stock')
                        .eq('id', undoingItem.book_id)
                        .single()

                    curStock = currentBook ? Number(currentBook.stock) : 0
                    if (undoingItem.quantity > 0 && curStock < undoingItem.quantity) {
                        throw new Error(`No se puede deshacer: el stock actual (${curStock} ud.) es insuficiente porque ya se vendieron unidades.`)
                    }
                }

                // 1. Delete stock movement record
                if (undoingItem.stock_movement_id) {
                    const { data: deletedMov, error: movErr } = await supabase
                        .from('stock_movements')
                        .delete()
                        .eq('id', undoingItem.stock_movement_id)
                        .select()

                    if (movErr) {
                        throw new Error('Error al deshacer movimiento: ' + movErr.message)
                    }
                    if (!deletedMov || deletedMov.length === 0) {
                        throw new Error('Supabase bloqueó el borrado (comprueba permisos DELETE en stock_movements).')
                    }
                }

                // 2. Revert book stock
                if (undoingItem.book_id > 0) {
                    const revertedStock = Math.max(0, curStock - undoingItem.quantity)
                    const { error: stockErr } = await supabase
                        .from('books')
                        .update({ stock: revertedStock })
                        .eq('id', undoingItem.book_id)

                    if (stockErr) {
                        console.error('Error reverting stock:', stockErr)
                    }
                }
            }

            setUndoingItem(null)
            setIsUndoing(false)
            await loadHistory()
            if (onUpdated) onUpdated()
        } catch (err: any) {
            console.error('Error undoing transaction:', err)
            setUndoError(err.message || 'Error al deshacer la transacción.')
            setIsUndoing(false)
        }
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
            label: `Autor: ${authorName}`,
        })
        setSelectedAuthorBookId('all')
        setSearchInputValue('')
        setIsDropdownOpen(false)
    }

    function selectBookFilter(book: Book) {
        setActiveFilter({
            type: 'book',
            value: book.id,
            label: `Libro: ${book.title}`,
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

    function exportToExcel() {
        if (!filteredItems || filteredItems.length === 0) {
            alert('No hay datos en la vista filtrada para exportar.')
            return
        }

        const categoryLabels: Record<string, string> = {
            all: 'Todos los registros',
            efectivo: 'Solo ventas en Efectivo',
            bizum: 'Solo ventas en Bizum',
            sales: 'Solo Ventas',
            stock: 'Solo Movimientos de Stock'
        }

        const shiftLabels: Record<string, string> = {
            all: 'Todos los turnos',
            morning: 'Mañana (08:00 - 15:00)',
            afternoon: 'Tarde (15:00 - 23:59)'
        }

        const filterLabelText = activeFilter ? activeFilter.label : 'Ninguno'
        const exportDateStr = new Date().toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })

        // Build Excel 2D Data Array
        const excelData: any[][] = [
            // Title Header Block
            ['REPORTE DE HISTORIAL DE MOVIMIENTOS Y VENTAS'],
            ['Feria:', fairName, '', 'Fecha Exportación:', exportDateStr],
            ['Filtro Categoría:', categoryLabels[categoryFilter] || categoryFilter, '', 'Filtro Turno:', shiftLabels[selectedShift] || selectedShift],
            ['Filtro Fecha:', selectedDate || 'Todas las fechas', '', 'Filtro Libro/Autor:', filterLabelText],
            [], // Empty row

            // KPI Summary Block
            ['RESUMEN DE DATOS FILTRADOS'],
            [
                'Ventas Totales (Reg.)',
                'Total Recaudado (€)',
                'Recaudación Efectivo (€)',
                'Recaudación Bizum (€)',
                'Unidades Vendidas',
                'Movimientos de Stock'
            ],
            [
                salesFiltered.length,
                totalRevenue.toFixed(2) + ' €',
                cashRevenue.toFixed(2) + ' €',
                bizumRevenue.toFixed(2) + ' €',
                totalUnitsSold,
                totalStockMovementsCount
            ],
            [], // Empty row

            // Main Table Header
            [
                'Fecha y Hora',
                'Tipo Operación',
                'Título del Libro',
                'Autor',
                'ISBN',
                'Cantidad',
                'Precio Unitario (€)',
                'Importe Total (€)',
                'Método / Detalle',
                'Comentario / Notas'
            ]
        ]

        // Populate Table Data Rows
        filteredItems.forEach(item => {
            const dt = new Date(item.created_at)
            const formattedDate = dt.toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })

            const isSale = item.type === 'sale'
            const tipoOp = isSale ? 'Venta' : 'Stock'
            const qtyStr = isSale ? item.quantity : (item.quantity > 0 ? `+${item.quantity}` : `${item.quantity}`)
            const unitPriceStr = isSale && item.unit_price !== undefined ? `${item.unit_price.toFixed(2)} €` : '-'
            const totalPriceStr = isSale && item.total_price !== undefined ? `${item.total_price.toFixed(2)} €` : '-'

            let metDetalle = '-'
            if (isSale) {
                metDetalle = item.payment_method === 'efectivo' ? 'Efectivo' : 'Bizum'
            } else {
                if (item.movement_type === 'initial') metDetalle = 'Stock Inicial'
                else if (item.movement_type === 'restock') metDetalle = 'Reposición (+)'
                else if (item.quantity < 0) metDetalle = 'Retirada (-)'
                else metDetalle = 'Ajuste'
            }

            excelData.push([
                formattedDate,
                tipoOp,
                item.book_title,
                item.book_author || '-',
                item.book_isbn || '-',
                qtyStr,
                unitPriceStr,
                totalPriceStr,
                metDetalle,
                item.notes || '-'
            ])
        })

        // Add Footer Row with Totals
        excelData.push([
            'TOTALES FILTRADOS',
            '',
            '',
            '',
            '',
            totalUnitsSold,
            '',
            `${totalRevenue.toFixed(2)} €`,
            '',
            ''
        ])

        // Create Worksheet
        const ws = XLSX.utils.aoa_to_sheet(excelData)

        // Calculate dynamic column widths
        const colWidths = excelData[9].map((_, colIdx) => {
            let maxLen = 12
            excelData.forEach((row, rowIdx) => {
                if (rowIdx >= 9 && row[colIdx] !== undefined && row[colIdx] !== null) {
                    const strLen = String(row[colIdx]).length
                    if (strLen > maxLen) maxLen = strLen
                }
            })
            return { wch: maxLen + 3 }
        })
        ws['!cols'] = colWidths

        // Create Workbook and download
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Historial Filtrado')

        const cleanFairName = fairName.replace(/[^a-zA-Z0-9]/g, '_')
        const todayStr = getLocalDateString(new Date())
        XLSX.writeFile(wb, `Historial_${cleanFairName}_${todayStr}.xlsx`)
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
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-200 text-slate-700 border border-slate-300">
                            <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Historial</h2>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs font-bold text-slate-800 border border-slate-300">
                        {fairName}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportToExcel}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-[0.98] transition shadow-xs cursor-pointer"
                        title="Descargar historial filtrado en Excel"
                    >
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <span>Descargar Excel</span>
                    </button>
                    <button
                        onClick={resetFilters}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 active:scale-[0.98] transition shadow-xs cursor-pointer"
                        title="Restablecer todos los filtros"
                    >
                        <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>Limpiar Filtros</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 bg-white p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition shadow-xs cursor-pointer ml-1"
                        title="Cerrar historial"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="my-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Combobox Search & Select Input */}
                    <div ref={comboboxRef} className="relative flex flex-col justify-between">
                        <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                            <span>Título, autor o ISBN</span>
                        </label>

                        {activeFilter ? (
                            <div className="flex flex-col gap-1.5">
                                {/* Active selection badge */}
                                <div className="flex items-center justify-between h-9 rounded-xl bg-slate-100 px-3 border border-slate-300">
                                    <div className="flex items-center gap-1.5 truncate">
                                        {activeFilter.type === 'author' ? (
                                            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                            </svg>
                                        )}
                                        <span className="text-xs font-bold text-slate-900 truncate">{activeFilter.label}</span>
                                    </div>
                                    <button
                                        onClick={clearActiveFilter}
                                        className="ml-2 rounded-md p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                                        title="Quitar filtro"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Secondary Book Selector if filtering by Author */}
                                {activeFilter.type === 'author' && booksBySelectedAuthor.length > 0 && (
                                    <select
                                        value={selectedAuthorBookId}
                                        onChange={e => setSelectedAuthorBookId(e.target.value)}
                                        className="w-full h-8 rounded-lg bg-[#fafafa] px-2.5 text-xs font-bold text-slate-900 border border-slate-300 outline-none cursor-pointer"
                                    >
                                        <option value="all">Todos los libros del autor ({booksBySelectedAuthor.length})</option>
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
                                                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                    </svg>
                                                    <span>Autores sugeridos ({matchingAuthors.length})</span>
                                                </div>
                                                {matchingAuthors.map(author => (
                                                    <button
                                                        key={`author-${author}`}
                                                        type="button"
                                                        onClick={() => selectAuthorFilter(author)}
                                                        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-slate-100 text-left transition cursor-pointer"
                                                    >
                                                        <span className="flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                            </svg>
                                                            <span>Todos los libros de: <strong>{author}</strong></span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">Ver autor</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Section 2: Books matching */}
                                        {matchingBooks.length > 0 && (
                                            <div>
                                                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                    <span>Libros ({matchingBooks.length})</span>
                                                </div>
                                                {matchingBooks.map(b => (
                                                    <button
                                                        key={`book-${b.id}`}
                                                        type="button"
                                                        onClick={() => selectBookFilter(b)}
                                                        className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 text-left transition cursor-pointer"
                                                    >
                                                        <div className="flex items-start gap-1.5">
                                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                            </svg>
                                                            <div>
                                                                <span className="font-bold">{b.title}</span>
                                                                {b.author && <span className="text-[10px] text-slate-500 block">{b.author}</span>}
                                                            </div>
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
                        <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Turno</span>
                        </label>
                        <select
                            value={selectedShift}
                            onChange={e => setSelectedShift(e.target.value as any)}
                            className="w-full h-9 rounded-xl bg-[#fafafa] px-3 text-sm font-medium text-slate-900 outline-none border border-slate-300 focus:border-slate-800"
                        >
                            <option value="all">Todos los turnos</option>
                            <option value="morning">Mañana (08:00 - 15:00)</option>
                            <option value="afternoon">Tarde (15:00 - 23:59)</option>
                        </select>
                    </div>

                    {/* Date Picker */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.253M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                <span>Fecha</span>
                            </label>
                            {selectedDate && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate('')}
                                    className="text-[10px] font-bold text-slate-700 hover:underline cursor-pointer"
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
                                className={`flex-1 h-9 rounded-xl px-3 text-sm font-medium outline-none border transition ${
                                    selectedDate
                                        ? 'border-blue-500 bg-blue-50/50 text-slate-900 ring-2 ring-blue-500/20 font-semibold'
                                        : 'bg-[#fafafa] text-slate-900 border-slate-300 focus:border-slate-800'
                                }`}
                            />
                            {(() => {
                                const todayDateStr = getLocalDateString(new Date())
                                const isTodaySelected = selectedDate === todayDateStr
                                return (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDate(isTodaySelected ? '' : todayDateStr)}
                                        className={`h-9 rounded-xl border px-3 text-xs font-bold transition cursor-pointer ${
                                            isTodaySelected
                                                ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20 shadow-sm'
                                                : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'
                                        }`}
                                    >
                                        Hoy
                                    </button>
                                )
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive KPI Filter Cards (Soft Blue Fill when Active, Black Numbers) */}
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {/* Total Recaudado (Card 1: Ver Todo) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-2xs cursor-pointer ${
                        categoryFilter === 'all'
                            ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Recaudado</span>
                        {categoryFilter === 'all' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>Todos</span>
                            </span>
                        )}
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 leading-tight mt-1">
                        {totalRevenue.toFixed(2)} €
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${categoryFilter === 'all' ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                        {salesFiltered.length} ventas
                    </span>
                </button>

                {/* Cash Balance (Card 2: Solo Efectivo) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'efectivo' ? 'all' : 'efectivo')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-2xs cursor-pointer ${
                        categoryFilter === 'efectivo'
                            ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                            </svg>
                            <span>Efectivo</span>
                        </span>
                        <div className="flex items-center gap-1">
                            {categoryFilter === 'efectivo' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    <span>Efectivo</span>
                                </span>
                            )}
                            <span className={`rounded px-1.5 text-[10px] font-extrabold border ${
                                categoryFilter === 'efectivo'
                                    ? 'bg-blue-100 border-blue-200 text-blue-900'
                                    : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}>
                                {totalRevenue > 0 ? ((cashRevenue / totalRevenue) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 leading-tight mt-1">
                        {cashRevenue.toFixed(2)} €
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${categoryFilter === 'efectivo' ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                        {cashSales.length} cobros {categoryFilter === 'efectivo' ? '(filtrado)' : ''}
                    </span>
                </button>

                {/* Bizum Balance (Card 3: Solo Bizum) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'bizum' ? 'all' : 'bizum')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-2xs cursor-pointer ${
                        categoryFilter === 'bizum'
                            ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                            <span>Bizum</span>
                        </span>
                        <div className="flex items-center gap-1">
                            {categoryFilter === 'bizum' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    <span>Bizum</span>
                                </span>
                            )}
                            <span className={`rounded px-1.5 text-[10px] font-extrabold border ${
                                categoryFilter === 'bizum'
                                    ? 'bg-blue-100 border-blue-200 text-blue-900'
                                    : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}>
                                {totalRevenue > 0 ? ((bizumRevenue / totalRevenue) * 100).toFixed(0) : 0}%
                            </span>
                        </div>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 leading-tight mt-1">
                        {bizumRevenue.toFixed(2)} €
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${categoryFilter === 'bizum' ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                        {bizumSales.length} cobros {categoryFilter === 'bizum' ? '(filtrado)' : ''}
                    </span>
                </button>

                {/* Volume Summary (Card 4: Solo Ventas) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'sales' ? 'all' : 'sales')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-2xs cursor-pointer ${
                        categoryFilter === 'sales'
                            ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <span>Libros Vendidos</span>
                        </span>
                        {categoryFilter === 'sales' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>Ventas</span>
                            </span>
                        )}
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 leading-tight mt-1">
                        {totalUnitsSold} <span className="text-xs font-semibold text-slate-600">uds.</span>
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${categoryFilter === 'sales' ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                        {salesFiltered.length} ventas {categoryFilter === 'sales' ? '(filtrado)' : ''}
                    </span>
                </button>

                {/* Stock Restante (Card 5: Solo Stock) */}
                <button
                    type="button"
                    onClick={() => setCategoryFilter(c => c === 'stock' ? 'all' : 'stock')}
                    className={`rounded-xl border p-3 flex flex-col justify-between text-left transition shadow-2xs cursor-pointer ${
                        categoryFilter === 'stock'
                            ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                            <span>Stock Restante</span>
                        </span>
                        {categoryFilter === 'stock' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                <span>Stock</span>
                            </span>
                        )}
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 leading-tight mt-1">
                        {remainingStock} <span className="text-xs font-semibold text-slate-600">uds.</span>
                    </div>
                    <span className={`text-[10px] font-medium mt-0.5 ${categoryFilter === 'stock' ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
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
                                className="mt-4 rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
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
                                        <th className="px-3 py-3 text-center w-24">Acción</th>
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
                                                                    <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                                                                    </svg>
                                                                    <span>Venta en Efectivo</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1 font-bold text-slate-900 border border-slate-300 text-xs">
                                                                    <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                                                                    </svg>
                                                                    <span>Venta por Bizum</span>
                                                                </span>
                                                            )
                                                        ) : item.movement_type === 'initial' ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 font-bold text-amber-900 border border-amber-300 text-xs">
                                                                <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                                                </svg>
                                                                <span>Stock Inicial</span>
                                                            </span>
                                                        ) : item.movement_type === 'adjustment' || item.quantity < 0 ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 font-bold text-rose-900 border border-rose-300 text-xs" title={item.notes ? `Motivo: ${item.notes}` : undefined}>
                                                                <svg className="w-3.5 h-3.5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                                                                </svg>
                                                                <span>Retirada de Stock</span>
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 px-2.5 py-1 font-bold text-blue-900 border border-blue-300 text-xs" title={item.notes ? `Nota: ${item.notes}` : undefined}>
                                                                <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                                                                </svg>
                                                                <span>Reposición de Stock</span>
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
                                                    ) : item.quantity === 0 ? (
                                                        <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-extrabold text-slate-700 text-xs border border-slate-300">
                                                            0 ud.
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

                                                {/* Undo Action Button */}
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    {(() => {
                                                        const restriction = getUndoRestriction(item)
                                                        if (restriction) {
                                                            return (
                                                                <span
                                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400 cursor-not-allowed opacity-75"
                                                                    title={restriction}
                                                                >
                                                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                                    </svg>
                                                                    <span>Bloqueado</span>
                                                                </span>
                                                            )
                                                        }
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setUndoingItem(item)
                                                                    setUndoError(null)
                                                                }}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition cursor-pointer shadow-2xs group"
                                                                title="Deshacer esta transacción"
                                                            >
                                                                <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                                                </svg>
                                                                <span>Deshacer</span>
                                                            </button>
                                                        )
                                                    })()}
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
                                    className="flex items-center justify-center rounded-xl border border-slate-300 bg-white p-1 text-slate-800 hover:bg-slate-100 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                    title="Página anterior"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                    </svg>
                                </button>
                                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                                    {validCurrentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={validCurrentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="flex items-center justify-center rounded-xl border border-slate-300 bg-white p-1 text-slate-800 hover:bg-slate-100 transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                    title="Página siguiente"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Close Button */}
                    <div className="sm:w-1/3 text-right">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-slate-700 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
                        >
                            Cerrar Historial
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de confirmación para Deshacer Transacción - Visual y sin texto excesivo */}
            {undoingItem && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-900 flex flex-col">
                        
                        {/* Header: Icono + Título */}
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                                    {undoingItem.type === 'sale' ? '¿Anular esta venta?' : '¿Deshacer movimiento?'}
                                </h4>
                                <span className="text-[11px] text-slate-500 font-medium">
                                    Se actualizará el stock automáticamente.
                                </span>
                            </div>
                        </div>

                        {/* Tarjeta de resumen visual */}
                        <div className="my-4 rounded-xl bg-slate-50 border border-slate-200/90 p-3.5 space-y-2.5 text-xs">
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-slate-500 font-bold shrink-0">Libro:</span>
                                <span className="font-extrabold text-slate-900 text-right truncate">
                                    {undoingItem.book_title}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-500 font-bold shrink-0">Stock:</span>
                                <span className="font-extrabold font-mono text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    {undoingItem.type === 'sale'
                                        ? `+${undoingItem.quantity} ud. al inventario`
                                        : undoingItem.quantity > 0
                                            ? `-${undoingItem.quantity} ud. (se resta)`
                                            : `+${Math.abs(undoingItem.quantity)} ud. (se suma)`
                                    }
                                </span>
                            </div>

                            {undoingItem.type === 'sale' && (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-slate-500 font-bold shrink-0">Caja:</span>
                                    <span className="font-extrabold font-mono text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
                                        -{undoingItem.total_price?.toFixed(2)} € ({undoingItem.payment_method === 'efectivo' ? 'Efectivo' : 'Bizum'})
                                    </span>
                                </div>
                            )}
                        </div>

                        {undoError && (
                            <div className="mb-3 rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs font-semibold text-red-700">
                                {undoError}
                            </div>
                        )}

                        {/* Botones de acción directos */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setUndoingItem(null)
                                    setUndoError(null)
                                }}
                                disabled={isUndoing}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmUndo}
                                disabled={isUndoing}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                            >
                                {isUndoing ? (
                                    <>
                                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        <span>Deshaciendo...</span>
                                    </>
                                ) : (
                                    <span>Confirmar</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
