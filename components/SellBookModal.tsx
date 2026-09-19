'use client'

import { useState } from 'react'
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

type Props = {
    book: Book
    discountPercentage: number
    onClose: () => void
    onSold: () => void
}

export default function SellBookModal({ book, discountPercentage, onClose, onSold }: Props) {
    const [quantity, setQuantity] = useState('1')
    const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'bizum'>('efectivo')
    const [selling, setSelling] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Calculate discounted unit price and total price
    const unitPrice = (book.price * (100 - discountPercentage)) / 100
    const qty = parseInt(quantity) || 1
    const totalPrice = unitPrice * qty

    async function handleConfirmSale() {
        const qtyNum = parseInt(quantity)
        if (isNaN(qtyNum) || qtyNum <= 0) {
            setErrorMsg('Indica una cantidad válida de unidades a vender.')
            return
        }

        if (qtyNum > book.stock) {
            setErrorMsg(`No hay suficiente stock disponible (${book.stock} unidades disponibles).`)
            return
        }

        setSelling(true)
        setErrorMsg(null)

        // 1. Insert header record into 'sales' table
        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert({
                fair_id: book.fair_id,
                total: parseFloat(totalPrice.toFixed(2)),
                payment_method: paymentMethod,
            })
            .select()
            .single()

        if (saleError) {
            console.error('Error recording sale header:', saleError)
            setErrorMsg(saleError.message || 'Error al registrar la venta en Supabase.')
            setSelling(false)
            return
        }

        // 2. Insert line item record into 'sale_items' table
        if (saleData) {
            const { error: itemError } = await supabase
                .from('sale_items')
                .insert({
                    sale_id: saleData.id,
                    book_id: book.id,
                    quantity: qtyNum,
                    price_at_sale: parseFloat(unitPrice.toFixed(2)),
                })

            if (itemError) {
                console.error('Error recording sale item:', itemError)
            }
        }

        // 2. Update stock in 'books' table
        const newStock = Math.max(0, book.stock - qtyNum)

        const { error: updateError } = await supabase
            .from('books')
            .update({ stock: newStock })
            .eq('id', book.id)

        if (updateError) {
            console.error('Error updating book inventory:', updateError)
            setErrorMsg(updateError.message || 'Error al actualizar el stock del libro.')
            setSelling(false)
            return
        }

        setSelling(false)
        onSold()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl border border-[#334155]">
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">🛒 Registrar Venta</h3>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        {discountPercentage}% Dto. Feria
                    </span>
                </div>

                {errorMsg && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                        {errorMsg}
                    </div>
                )}

                {/* Book Details Summary */}
                <div className="mb-6 rounded-xl bg-[#0f172a] p-4 border border-[#334155]">
                    <h4 className="font-bold text-white text-base">{book.title}</h4>
                    {book.author && <p className="text-xs text-[#94a3b8] mt-0.5">{book.author}</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-[#1e293b] pt-3 text-xs">
                        <span className="text-[#94a3b8]">Precio original: <span className="line-through">{book.price.toFixed(2)} €</span></span>
                        <span className="text-[#94a3b8]">Precio Feria: <strong className="text-emerald-400 text-sm">{unitPrice.toFixed(2)} €</strong></span>
                        <span className="text-[#94a3b8]">Stock: <strong className="text-white">{book.stock}</strong></span>
                    </div>
                </div>

                {/* Form Inputs */}
                <div className="flex flex-col gap-5">
                    {/* Quantity Selector */}
                    <div>
                        <label className="mb-2 block text-xs font-medium text-[#94a3b8]">Cantidad a vender *</label>
                        <div className="flex items-center gap-2">
                            {['1', '2', '3'].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setQuantity(num)}
                                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition ${
                                        quantity === num
                                            ? 'border-[#6366f1] bg-[#6366f1] text-white'
                                            : 'border-[#334155] bg-[#0f172a] text-[#94a3b8] hover:text-white'
                                    }`}
                                >
                                    {num} {num === '1' ? 'libro' : 'libros'}
                                </button>
                            ))}
                            <input
                                type="number"
                                min="1"
                                max={book.stock}
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                                className="w-20 rounded-lg bg-[#0f172a] px-3 py-2 text-center text-sm font-bold text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                        </div>
                    </div>

                    {/* Payment Method Selector (Efectivo vs Bizum) */}
                    <div>
                        <label className="mb-2 block text-xs font-medium text-[#94a3b8]">Método de Pago *</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('efectivo')}
                                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-bold transition ${
                                    paymentMethod === 'efectivo'
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/30'
                                        : 'border-[#334155] bg-[#0f172a] text-[#94a3b8] hover:text-white'
                                }`}
                            >
                                <span className="text-xl">💵</span>
                                <span>Efectivo</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setPaymentMethod('bizum')}
                                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-bold transition ${
                                    paymentMethod === 'bizum'
                                        ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1] ring-2 ring-[#6366f1]/30'
                                        : 'border-[#334155] bg-[#0f172a] text-[#94a3b8] hover:text-white'
                                }`}
                            >
                                <span className="text-xl">📲</span>
                                <span>Bizum</span>
                            </button>
                        </div>
                    </div>

                    {/* Total Price Display */}
                    <div className="flex items-center justify-between rounded-xl bg-[#0f172a] px-5 py-4 border border-[#334155]">
                        <span className="text-sm font-semibold text-[#94a3b8]">Total a cobrar:</span>
                        <span className="text-2xl font-extrabold text-white">
                            {totalPrice.toFixed(2)} €
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-[#334155] py-3 text-sm font-semibold text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmSale}
                        disabled={selling || book.stock < 1}
                        className="flex-1 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50 shadow-lg shadow-emerald-900/30"
                    >
                        {selling ? 'Registrando...' : 'Confirmar Venta'}
                    </button>
                </div>
            </div>
        </div>
    )
}
