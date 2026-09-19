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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl border border-[#334155]">
                <h3 className="mb-6 text-xl font-bold text-white">Editar Feria</h3>

                {errorMsg && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                        {errorMsg}
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1 block text-xs text-[#94a3b8]">Nombre de la feria *</label>
                        <input
                            type="text"
                            placeholder="Nombre de la feria"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs text-[#94a3b8]">Ubicación</label>
                        <input
                            type="text"
                            placeholder="Ubicación"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs text-[#94a3b8]">Descuento de la feria (%) *</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder="Ej. 10"
                            value={discountPercentage}
                            onChange={e => setDiscountPercentage(e.target.value)}
                            required
                            className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-1 block text-xs text-[#94a3b8]">Fecha de inicio</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="mb-1 block text-xs text-[#94a3b8]">Fecha de fin</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full rounded-lg bg-[#0f172a] px-4 py-3 text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
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
