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
    const [saving, setSaving] = useState(false)

    async function handleSubmit() {
        if (!name.trim()) return

        setSaving(true)

        const { error } = await supabase
            .from('fairs')
            .insert({
                name: name.trim(),
                location: location || null,
                start_date: startDate || null,
                end_date: endDate || null,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-2xl bg-[#1e293b] p-8 shadow-2xl">

                <h3 className="mb-6 text-xl font-bold text-white">Nueva Feria</h3>

                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="Nombre de la feria *"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />
                    <input
                        type="text"
                        placeholder="Ubicación"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white placeholder-[#94a3b8] outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="rounded-lg bg-[#0f172a] px-4 py-3 text-white outline-none ring-1 ring-[#334155] focus:ring-[#6366f1]"
                    />
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-[#334155] py-3 font-semibold text-[#94a3b8] transition hover:bg-[#334155]">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 rounded-lg bg-[#6366f1] py-3 font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Crear Feria'}
                    </button>
                </div>

            </div>
        </div>
    )
}