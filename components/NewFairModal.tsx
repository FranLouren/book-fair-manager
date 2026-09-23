'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Props that the modal receives from the parent
type Props = {
    onClose: () => void
    onCreated: () => void
}

export default function NewFairModal({ onClose, onCreated }: Props) {
    const [name, setName] = useState('')
    const [location, setLocation] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [discountPercentage, setDiscountPercentage] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSubmit() {
        if (!name.trim() || !discountPercentage) return

        setSaving(true)

        const { error } = await supabase
            .from('fairs')
            .insert({
                name: name.trim(),
                location: location || null,
                start_date: startDate || null,
                end_date: endDate || null,
                discount_percentage: parseFloat(discountPercentage) || 0,
            })

        if (error) {
            console.error('Error creating fair:', error)
            setSaving(false)
            return
        }

        setSaving(false)
        onCreated()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#fafafa] p-8 shadow-xl border border-slate-200 text-slate-900">

                <h3 className="mb-6 text-2xl font-extrabold text-slate-900 tracking-tight">Nueva Feria</h3>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-800">
                            Nombre de la feria *
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. Feria del Libro de León 2026"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-800">
                            Ubicación
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. Plaza de Regla, León"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-800">
                            Descuento de la feria (%) *
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder="Ej. 10"
                            value={discountPercentage}
                            onChange={e => setDiscountPercentage(e.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium placeholder:text-slate-400 outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-1.5 block text-sm font-bold text-slate-800">
                                Fecha de inicio
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="mb-1.5 block text-sm font-bold text-slate-800">
                                Fecha de fin
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-medium outline-none transition focus:border-slate-800 focus:ring-2 focus:ring-slate-800/10"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Crear Feria'}
                    </button>
                </div>

            </div>
        </div>
    )
}