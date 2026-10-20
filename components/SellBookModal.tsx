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
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Registrar Venta</h3>
                    </div>
                    <span className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800">
                        {discountPercentage}% Dto. Feria
                    </span>
                </div>

                {book.stock <= 0 && (
                    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 p-4 text-sm font-extrabold text-amber-900 flex items-center gap-2.5 shadow-xs">
                        <svg className="w-5 h-5 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
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
                                <svg className="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                                </svg>
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
                                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                                </svg>
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
