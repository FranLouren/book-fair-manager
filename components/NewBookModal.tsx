'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Props received from parent component
type Props = {
    fairId: number | string
    onClose: () => void
    onCreated: () => void
}

export default function NewBookModal({ fairId, onClose, onCreated }: Props) {
    // Form fields state
    const [title, setTitle] = useState('')
    const [author, setAuthor] = useState('')
    const [isbn, setIsbn] = useState('')
    const [price, setPrice] = useState('')
    const [stock, setStock] = useState('1')
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Submit handler to insert book into Supabase
    async function handleSubmit() {
        // Check for missing mandatory fields
        const missing: string[] = []
        if (!title.trim()) missing.push('Título')
        if (!author.trim()) missing.push('Autor')
        if (!isbn.trim()) missing.push('ISBN')
        if (!price || parseFloat(price) <= 0) missing.push('Precio')
        if (!stock || parseInt(stock) < 1) missing.push('Stock')

        if (missing.length > 0) {
            setErrorMsg(`Por favor, rellena los siguientes campos obligatorios: ${missing.join(', ')}.`)
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
                author: author.trim(),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl border border-[#334155]">
                <h3 className="mb-6 text-xl font-bold text-white">Añadir Nuevo Libro</h3>

                {errorMsg && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                        {errorMsg}
                    </div>
                )}

                {/* Form inputs */}
                <div className="flex flex-col gap-4">
                    {/* Title */}
                    <input
                        type="text"
                        placeholder="Título del libro *"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />

                    {/* Author */}
                    <input
                        type="text"
                        placeholder="Autor / Autora *"
                        value={author}
                        onChange={e => setAuthor(e.target.value)}
                        required
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />

                    {/* ISBN */}
                    <input
                        type="text"
                        placeholder="ISBN *"
                        value={isbn}
                        onChange={e => setIsbn(e.target.value)}
                        required
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />

                    <div className="flex gap-4">
                        {/* Price */}
                        <div className="flex-1">
                            <label className="mb-1 block text-xs text-[#94a3b8]">Precio (€) *</label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                required
                                className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                        </div>

                        {/* Stock */}
                        <div className="flex-1">
                            <label className="mb-1 block text-xs text-[#94a3b8]">Cantidad / Stock *</label>
                            <input
                                type="number"
                                min="1"
                                value={stock}
                                onChange={e => setStock(e.target.value)}
                                required
                                className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-[#334155] py-3 font-semibold text-[#94a3b8] transition hover:bg-[#334155]"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 rounded-lg bg-[#6366f1] py-3 font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Añadir Libro'}
                    </button>
                </div>
            </div>
        </div>
    )
}
