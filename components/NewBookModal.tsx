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
    // 1. Form fields state
    const [title, setTitle] = useState('')
    const [author, setAuthor] = useState('')
    const [price, setPrice] = useState('')
    const [stock, setStock] = useState('1')
    const [saving, setSaving] = useState(false)

    // 2. Submit handler to insert book into Supabase
    async function handleSubmit() {
        if (!title.trim() || !price) return

        setSaving(true)

        const { error } = await supabase
            .from('books')
            .insert({
                fair_id: Number(fairId),
                title: title.trim(),
                author: author.trim() || null,
                price: parseFloat(price) || 0,
                stock: parseInt(stock) || 1,
            })

        if (error) {
            console.error('Error creating book:', error)
            setSaving(false)
            return
        }

        setSaving(false)
        onCreated()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl">
                <h3 className="mb-6 text-xl font-bold text-white">Añadir Nuevo Libro</h3>

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
                        placeholder="Autor / Autora"
                        value={author}
                        onChange={e => setAuthor(e.target.value)}
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
