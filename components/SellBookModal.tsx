'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

type Book = {
    id: number
    fair_id: number
    title: string
    author: string | null
    isbn: string
    price: number
    stock: number
    sold?: number
}

type CartItem = {
    book: Book
    quantity: number
}

type Props = {
    fairId: number
    books: Book[]
    discountPercentage: number
    onClose: () => void
    onSold: () => void
}

// Helper to calculate exact 2-decimal rounded unit price with discount
function getDiscountedUnitPrice(basePrice: number, discountPercentage: number): number {
    return parseFloat(((basePrice * (100 - discountPercentage)) / 100).toFixed(2))
}

export default function SellBookModal({
    fairId,
    books,
    discountPercentage,
    onClose,
    onSold,
}: Props) {
    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'bizum'>('efectivo')
    const [selling, setSelling] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const searchContainerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Close search dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Filter books matching search query
    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return []
        return books.filter(b => {
            const titleMatch = b.title.toLowerCase().includes(query)
            const authorMatch = b.author ? b.author.toLowerCase().includes(query) : false
            const isbnMatch = b.isbn ? b.isbn.toLowerCase().includes(query) : false
            return titleMatch || authorMatch || isbnMatch
        }).slice(0, 8)
    }, [books, searchQuery])

    // Calculate totals
    const totalItemsCount = useMemo(() => {
        return cartItems.reduce((acc, item) => acc + item.quantity, 0)
    }, [cartItems])

    const totalPrice = useMemo(() => {
        return cartItems.reduce((acc, item) => {
            const unitPrice = getDiscountedUnitPrice(item.book.price, discountPercentage)
            return parseFloat((acc + unitPrice * item.quantity).toFixed(2))
        }, 0)
    }, [cartItems, discountPercentage])

    // Add a book to current sale
    function handleAddBook(bookToAdd: Book) {
        if (bookToAdd.stock <= 0) return

        setCartItems(prev => {
            const existingIndex = prev.findIndex(item => item.book.id === bookToAdd.id)
            if (existingIndex > -1) {
                const current = prev[existingIndex]
                if (current.quantity < bookToAdd.stock) {
                    const updated = [...prev]
                    updated[existingIndex] = { ...current, quantity: current.quantity + 1 }
                    return updated
                }
                return prev
            } else {
                return [...prev, { book: bookToAdd, quantity: 1 }]
            }
        })

        setSearchQuery('')
        setIsDropdownOpen(false)
        setErrorMsg(null)
        if (searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }

    // Change quantity of an item
    function handleUpdateQuantity(bookId: number, newQty: number) {
        setCartItems(prev =>
            prev.map(item => {
                if (item.book.id !== bookId) return item
                const validQty = Math.max(1, Math.min(item.book.stock, newQty))
                return { ...item, quantity: validQty }
            })
        )
    }

    // Remove item from cart
    function handleRemoveItem(bookId: number) {
        setCartItems(prev => prev.filter(item => item.book.id !== bookId))
    }

    // Confirm and complete sale
    async function handleConfirmSale() {
        if (cartItems.length === 0) {
            setErrorMsg('Añade al menos un libro para cobrar.')
            return
        }

        // Validate stock
        for (const item of cartItems) {
            if (item.quantity > item.book.stock) {
                setErrorMsg(`No hay suficiente stock para "${item.book.title}". Stock disponible: ${item.book.stock}`)
                return
            }
        }

        setSelling(true)
        setErrorMsg(null)

        try {
            // 1. Insert header record into 'sales' table
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert({
                    fair_id: fairId,
                    total: parseFloat(totalPrice.toFixed(2)),
                    payment_method: paymentMethod,
                })
                .select()
                .single()

            if (saleError || !saleData) {
                console.error('Error recording sale header:', saleError)
                setErrorMsg(saleError?.message || 'Error al registrar la venta.')
                setSelling(false)
                return
            }

            // 2. Insert line items into 'sale_items' table
            const saleItemsPayload = cartItems.map(item => {
                const unitPrice = getDiscountedUnitPrice(item.book.price, discountPercentage)
                return {
                    sale_id: saleData.id,
                    book_id: item.book.id,
                    quantity: item.quantity,
                    price_at_sale: unitPrice,
                }
            })

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(saleItemsPayload)

            if (itemsError) {
                console.error('Error recording sale items:', itemsError)
            }

            // 3. Update stock in 'books' table
            for (const item of cartItems) {
                const newStock = Math.max(0, item.book.stock - item.quantity)
                const { error: updateError } = await supabase
                    .from('books')
                    .update({ stock: newStock })
                    .eq('id', item.book.id)

                if (updateError) {
                    console.error('Error updating stock for book:', item.book.id, updateError)
                }
            }

            onSold()
            onClose()
        } catch (err: any) {
            console.error('Unexpected error recording sale:', err)
            setErrorMsg(err.message || 'Error inesperado al registrar la venta.')
            setSelling(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-xl rounded-2xl bg-[#fafafa] p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 flex flex-col my-auto max-h-[92vh]">
                {/* Header: limpio y sin subtítulo */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Nueva Venta</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            {discountPercentage}% Dto.
                        </span>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                            title="Cerrar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Contenido: los 3 bloques principales */}
                <div className="flex-1 overflow-y-auto py-3.5 space-y-3">
                    {/* Alerta de error sutil */}
                    {errorMsg && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-semibold flex items-center gap-2">
                            <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* BLOQUE 1: Buscador directo sin etiquetas */}
                    <div ref={searchContainerRef} className="relative">
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                ref={searchInputRef}
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    setIsDropdownOpen(true)
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                placeholder="Buscar libro por título, autor o ISBN..."
                                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 shadow-2xs"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('')
                                        setIsDropdownOpen(false)
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Desplegable de resultados */}
                        {isDropdownOpen && searchQuery.trim().length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                {searchResults.length === 0 ? (
                                    <div className="py-3 text-center text-xs font-medium text-slate-400">
                                        No se encontraron libros
                                    </div>
                                ) : (
                                    searchResults.map(b => {
                                        const discounted = getDiscountedUnitPrice(b.price, discountPercentage)
                                        const inCart = cartItems.find(it => it.book.id === b.id)
                                        const isOutOfStock = b.stock <= 0
                                        const reachedMax = inCart ? inCart.quantity >= b.stock : false

                                        return (
                                            <button
                                                key={b.id}
                                                type="button"
                                                disabled={isOutOfStock || reachedMax}
                                                onClick={() => handleAddBook(b)}
                                                className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition text-xs ${
                                                    isOutOfStock || reachedMax
                                                        ? 'opacity-50 cursor-not-allowed bg-slate-50'
                                                        : 'hover:bg-emerald-50/70 hover:text-emerald-950 cursor-pointer'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-slate-900 truncate">{b.title}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">
                                                        {b.author || 'Sin autor'} {b.isbn ? `• ${b.isbn}` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-mono text-emerald-800 font-extrabold text-xs">
                                                        {discounted.toFixed(2)} €
                                                    </span>
                                                    <span
                                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                            isOutOfStock
                                                                ? 'bg-rose-100 text-rose-700'
                                                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                        }`}
                                                    >
                                                        {isOutOfStock ? 'Agotado' : `Stock: ${b.stock}`}
                                                    </span>
                                                    {inCart && (
                                                        <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                                                            {inCart.quantity} en ticket
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* BLOQUE 2: Dashboard / Ticket de libros */}
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
                        {cartItems.length === 0 ? (
                            <div className="py-7 text-center">
                                <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <p className="text-xs font-bold text-slate-400">Ticket vacío</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
                                {cartItems.map(item => {
                                    const unitPrice = getDiscountedUnitPrice(item.book.price, discountPercentage)
                                    const subtotal = parseFloat((unitPrice * item.quantity).toFixed(2))

                                    return (
                                        <div
                                            key={item.book.id}
                                            className="flex items-center justify-between gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 transition hover:bg-slate-50"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.book.title}</h4>
                                                <p className="text-[11px] text-slate-500 truncate">
                                                    {item.book.author || 'Sin autor'} • <span className="text-slate-600 font-medium">Stock: {item.book.stock}</span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2.5 shrink-0">
                                                {/* Selector de cantidad */}
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateQuantity(item.book.id, item.quantity - 1)}
                                                        disabled={item.quantity <= 1}
                                                        className="h-6.5 w-6.5 flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer disabled:opacity-30 text-xs"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="w-7 text-center text-xs font-bold text-slate-900 font-mono">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateQuantity(item.book.id, item.quantity + 1)}
                                                        disabled={item.quantity >= item.book.stock}
                                                        className="h-6.5 w-6.5 flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer disabled:opacity-30 text-xs"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                {/* Subtotal */}
                                                <span className="w-16 text-right font-extrabold text-emerald-800 text-xs sm:text-sm font-mono">
                                                    {subtotal.toFixed(2)} €
                                                </span>

                                                {/* Eliminar fila */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.book.id)}
                                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                    title="Eliminar"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* BLOQUE 3: Método de Pago (Directo y sin títulos) */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('efectivo')}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
                                paymentMethod === 'efectivo'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                            </svg>
                            <span>Efectivo</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPaymentMethod('bizum')}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs sm:text-sm font-bold transition cursor-pointer ${
                                paymentMethod === 'bizum'
                                    ? 'border-slate-800 bg-slate-800 text-white ring-2 ring-slate-800/20 shadow-2xs'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                            <span>Bizum</span>
                        </button>
                    </div>
                </div>

                {/* Pie de modal: Total y Botón de Cobro unificados en una sola fila */}
                <div className="pt-3.5 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total a cobrar</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-900 font-mono">
                                {totalPrice.toFixed(2)} €
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                                ({totalItemsCount} {totalItemsCount === 1 ? 'ud' : 'uds'})
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmSale}
                            disabled={selling || cartItems.length === 0}
                            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
                        >
                            {selling ? 'Guardando...' : 'Cobrar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
