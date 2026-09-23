'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Fair = {
    id: number
    name: string
    location: string | null
    start_date: string | null
    end_date: string | null
    discount_percentage?: number
    created_at: string
}

type Props = {
    fair: Fair
    onClose: () => void
    onUpdated: () => void
}

export default function EditFairModal({ fair, onClose, onUpdated }: Props) {
    const [name, setName] = useState(fair.name)
    const [location, setLocation] = useState(fair.location || '')
    const [startDate, setStartDate] = useState(fair.start_date || '')
    const [endDate, setEndDate] = useState(fair.end_date || '')
    const [discountPercentage, setDiscountPercentage] = useState(
        fair.discount_percentage ? fair.discount_percentage.toString() : '10'
    )
    const [saving, setSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    async function handleSubmit() {
        if (!name.trim() || !discountPercentage) {
            setErrorMsg('Por favor, completa los campos obligatorios (Nombre y Descuento).')
            return
        }

        setSaving(true)
        setErrorMsg(null)

        const { error } = await supabase
            .from('fairs')
            .update({
                name: name.trim(),
                location: location || null,
                start_date: startDate || null,
                end_date: endDate || null,
                discount_percentage: parseFloat(discountPercentage) || 0,
            })
            .eq('id', fair.id)

        if (error) {
            console.error('Error updating fair:', error)
            setErrorMsg(error.message || 'Error al actualizar la feria')
            setSaving(false)
            return
        }

        setSaving(false)
        onUpdated()
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#fafafa] p-8 shadow-xl border border-slate-200 text-slate-900">
                <h3 className="mb-6 text-2xl font-extrabold text-slate-900 tracking-tight">Editar Feria</h3>

                {errorMsg && (
                    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm font-semibold text-red-700">
                        {errorMsg}
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-bold text-slate-800">
                            Nombre de la feria *
                        </label>
                        <input
                            type="text"
                            placeholder="Nombre de la feria"
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
                            placeholder="Ubicación"
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

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-200/60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    )
}
