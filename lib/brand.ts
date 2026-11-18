export type AppTheme = 'slate' | 'blue' | 'warm'

const THEMES = {
    slate: {
        pageBg: 'bg-[#eaedf1]',
        headerBorderTop: 'border-t-slate-900',
        primaryBtn: 'bg-slate-700 hover:bg-slate-800 text-white',
        primaryBtnDark: 'bg-slate-900 hover:bg-slate-800 text-white',
        accentBadge: 'bg-slate-100 text-slate-700 border-slate-200/90',
        loginGradient: 'from-slate-50 via-slate-100 to-indigo-50/40',
        loadingBg: 'bg-[#f3f4f6]',
    },
    blue: {
        pageBg: 'bg-[#eaf0f6]', // Azul corporativo suave y limpio
        headerBorderTop: 'border-t-blue-700',
        primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
        primaryBtnDark: 'bg-blue-900 hover:bg-blue-800 text-white',
        accentBadge: 'bg-blue-50 text-blue-700 border-blue-200/90',
        loginGradient: 'from-blue-50/80 via-slate-50 to-blue-100/50',
        loadingBg: 'bg-[#eaf0f6]',
    },
    warm: {
        pageBg: 'bg-[#f6f4ee]', // Tono crema / papel editorial
        headerBorderTop: 'border-t-amber-900',
        primaryBtn: 'bg-amber-800 hover:bg-amber-900 text-white',
        primaryBtnDark: 'bg-stone-900 hover:bg-stone-800 text-white',
        accentBadge: 'bg-amber-50 text-amber-900 border-amber-200/90',
        loginGradient: 'from-amber-50/50 via-stone-50 to-orange-50/30',
        loadingBg: 'bg-[#f6f4ee]',
    },
}

const rawTheme = (process.env.NEXT_PUBLIC_THEME || 'slate').toLowerCase()
const selectedThemeKey: AppTheme = rawTheme in THEMES ? (rawTheme as AppTheme) : 'slate'

export const BRAND = {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Masticadores León',
    subtitle: process.env.NEXT_PUBLIC_APP_SUBTITLE || 'Gestión de Ferias del Libro',
    title:
        process.env.NEXT_PUBLIC_APP_TITLE ||
        process.env.NEXT_PUBLIC_APP_NAME ||
        'Feria Masticadores',
    logo: process.env.NEXT_PUBLIC_APP_LOGO || '/logo.jpg',
    showLogo: process.env.NEXT_PUBLIC_APP_LOGO !== 'none',
    themeName: selectedThemeKey,
    theme: THEMES[selectedThemeKey],
}
