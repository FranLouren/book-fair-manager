'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Book = {
    id: number
    title: string
    author: string | null
    isbn: string
    price: number
    stock: number
}

type Props = {
    book: Book
    onClose: () => void
    onUpdated: () => void
}

export default function EditBookModal({ book, onClose, onUpdated }: Props) {
    // Form fields initialized with existing book data
    const [title, setTitle] = useState(book.title)
    const [author, setAuthor] = useState(book.author || '')
    const [isbn, setIsbn] = useState(book.isbn || '')
    const [price, setPrice] = useState(book.price.toString())
    const [stock, setStock] = useState(book.stock.toString())
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Submit handler to update book in Supabase
    async function handleSubmit() {
        // Check for missing mandatory fields
        const missing: string[] = []
        if (!title.trim()) missing.push('Título')
        if (!author.trim()) missing.push('Autor')
        if (!isbn.trim()) missing.push('ISBN')
        if (!price || parseFloat(price) <= 0) missing.push('Precio')
        if (!stock || parseInt(stock) < 0) missing.push('Stock')

        if (missing.length > 0) {
            setErrorMsg(`Por favor, rellena los siguientes campos obligatorios: ${missing.join(', ')}.`)
            return
        }

        setSaving(true)
        setErrorMsg(null)

        const { error } = await supabase
            .from('books')
            .update({
                title: title.trim(),
                author: author.trim(),
                isbn: isbn.trim(),
                price: parseFloat(price) || 0,
                stock: parseInt(stock) || 0,
            })
            .eq('id', book.id)

        if (error) {
            console.error('Error updating book:', error)
            if (error.code === '23505') {
                setErrorMsg('Ya existe otro libro registrado con este ISBN en esta feria.')
            } else {
                setErrorMsg(error.message || 'Error al actualizar el libro')
            }
            setSaving(false)
            return
        }

        setSaving(false)
        onUpdated()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl border border-[#334155]">
                <h3 className="mb-6 text-xl font-bold text-white">Editar Libro</h3>

                {errorMsg && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                        {errorMsg}
                    </div>
                )}

                {/* Form inputs */}
                <div className="flex flex-col gap-4">
                    {/* Title */}
                    <div>
                        <label className="mb-1 block text-xs text-[#94a3b8]">Título del libro *</label>
                        <input
                            type="text"
                            placeholder="Título del libro"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        />
                    </div>

                    {/* Author */}
                    <div>
                        <label className="mb-1 block text-xs text-[#94a3b8]">Autor / Autora *</label>
                        <input
                            type="text"
                            placeholder="Autor / Autora"
                            value={author}
                            onChange={e => setAuthor(e.target.value)}
                            required
                            className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        />
                    </div>

                    {/* ISBN */}
                    <div>
                        <label className="mb-1 block text-xs text-[#94a3b8]">ISBN *</label>
                        <input
                            type="text"
                            placeholder="ISBN"
                            value={isbn}
                            onChange={e => setIsbn(e.target.value)}
                            required
                            className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        />
                    </div>

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
                                min="0"
                                value={stock}
                                onChange={e => setStock(e.target.value)}
                                required
                                className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-[#334155] px-4 py-2.5 text-sm font-semibold text-[#94a3b8] transition hover:bg-[#334155] hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="rounded-lg bg-[#6366f1] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}
