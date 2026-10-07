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

        // 3. Update stock in 'books' table
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#fafafa] p-8 shadow-xl border border-slate-200 text-slate-900">
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">🛒 Registrar Venta</h3>
                    <span className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800">
                        {discountPercentage}% Dto. Feria
                    </span>
                </div>

                {book.stock <= 0 && (
                    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 p-4 text-sm font-extrabold text-amber-900 flex items-center gap-2.5 shadow-xs">
                        <span className="text-xl">⚠️</span>
                        <span>No hay stock disponible de este libro.</span>
                    </div>
                )}

                {errorMsg && (
                    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-semibold">
                        {errorMsg}
                    </div>
                )}

                {/* Book Details Summary */}
                <div className="mb-6 rounded-xl bg-white p-4 border border-slate-200/90 shadow-xs">
                    <h4 className="font-bold text-slate-900 text-base">{book.title}</h4>
                    {book.author && <p className="text-xs text-slate-600 font-medium mt-0.5">{book.author}</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="text-slate-500 font-medium">Precio original: <span className="line-through">{book.price.toFixed(2)} €</span></span>
                        <span className="text-slate-500 font-medium">Precio Feria: <strong className="text-emerald-700 text-sm">{unitPrice.toFixed(2)} €</strong></span>
                        <span className="text-slate-500 font-medium">Stock: <strong className="text-slate-900 font-bold">{book.stock}</strong></span>
                    </div>
                </div>

                {/* Form Inputs */}
                <div className="flex flex-col gap-5">
                    {/* Quantity Selector */}
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-800">Cantidad a vender *</label>
                        <div className="flex items-center gap-2">
                            {['1', '2', '3'].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setQuantity(num)}
                                    className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${
                                        quantity === num
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
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
                                className="w-20 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-center text-sm font-bold text-slate-900 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>
                    </div>

                    {/* Payment Method Selector (Efectivo vs Bizum) */}
                    <div>
                        <label className="mb-2 block text-sm font-bold text-slate-800">Método de Pago *</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('efectivo')}
                                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-bold transition ${
                                    paymentMethod === 'efectivo'
                                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
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
                                        ? 'border-slate-900 bg-slate-900 text-white ring-2 ring-slate-800/20'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <span className="text-xl">📲</span>
                                <span>Bizum</span>
                            </button>
                        </div>
                    </div>

                    {/* Total Price Display */}
                    <div className="flex items-center justify-between rounded-xl bg-white px-5 py-4 border border-slate-300 shadow-xs">
                        <span className="text-sm font-bold text-slate-700">Total a cobrar:</span>
                        <span className="text-2xl font-black text-slate-900">
                            {totalPrice.toFixed(2)} €
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmSale}
                        disabled={selling || book.stock < 1}
                        className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                    >
                        {selling ? 'Registrando...' : 'Confirmar Venta'}
                    </button>
                </div>
            </div>
        </div>
    )
}
