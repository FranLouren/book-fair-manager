export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-[#0f172a]">

            {/* Header */}
            <header className="border-b border-[#1e293b] bg-[#0f172a] px-8 py-5">
                <div>
                    <h1 className="text-xl font-bold text-white">Masticadores León</h1>
                    <p className="text-sm text-[#94a3b8]">Gestión de Ferias del Libro</p>
                </div>
            </header>

            {/* Content */}
            <main className="p-8">
                {/* Section header */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Ferias</h2>
                    <button className="rounded-lg bg-[#6366f1] px-5 py-2.5 font-semibold text-white transition hover:bg-[#4f46e5]">
                        + Nueva Feria
                    </button>
                </div>

                {/* Empty state */}
                <div className="rounded-2xl border border-[#334155] bg-[#1e293b] p-16 text-center">
                    <p className="text-4xl">📚</p>
                    <p className="mt-4 text-lg font-medium text-white">No hay ferias todavía</p>
                    <p className="mt-2 text-sm text-[#94a3b8]">
                        Crea tu primera feria para empezar a gestionar libros y ventas
                    </p>
                </div>
            </main>

        </div>
    )
}