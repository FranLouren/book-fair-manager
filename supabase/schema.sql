-- ============================================================================
-- Book Fair Manager - Supabase Database Schema & RLS Policies
-- ============================================================================
-- Ejecuta este script completo en el SQL Editor de un proyecto nuevo de Supabase
-- para crear todas las tablas, relaciones y permisos de una sola vez.
-- ============================================================================

-- 1. Ferias (fairs)
CREATE TABLE IF NOT EXISTS public.fairs (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Autores (authors)
CREATE TABLE IF NOT EXISTS public.authors (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Libros (books)
CREATE TABLE IF NOT EXISTS public.books (
    id BIGSERIAL PRIMARY KEY,
    fair_id BIGINT REFERENCES public.fairs(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES public.authors(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Ventas (sales)
CREATE TABLE IF NOT EXISTS public.sales (
    id BIGSERIAL PRIMARY KEY,
    fair_id BIGINT NOT NULL REFERENCES public.fairs(id) ON DELETE CASCADE,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'bizum')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Lineas de venta (sale_items)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_sale NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Movimientos de stock (stock_movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id BIGSERIAL PRIMARY KEY,
    fair_id BIGINT NOT NULL REFERENCES public.fairs(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    movement_type TEXT NOT NULL DEFAULT 'restock' CHECK (movement_type IN ('initial', 'restock', 'adjustment')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices recomendados para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_books_fair_id ON public.books(fair_id);
CREATE INDEX IF NOT EXISTS idx_books_author_id ON public.books(author_id);
CREATE INDEX IF NOT EXISTS idx_sales_fair_id ON public.sales(fair_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_book_id ON public.sale_items(book_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_fair_id ON public.stock_movements(fair_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_book_id ON public.stock_movements(book_id);

-- ============================================================================
-- Permisos de tabla en PostgreSQL (GRANT)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ============================================================================
-- Row Level Security (RLS) - Acceso completo (anon y authenticated)
-- ============================================================================
ALTER TABLE public.fairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access on fairs" ON public.fairs;
DROP POLICY IF EXISTS "Authenticated full access on authors" ON public.authors;
DROP POLICY IF EXISTS "Authenticated full access on books" ON public.books;
DROP POLICY IF EXISTS "Authenticated full access on sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated full access on sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated full access on stock_movements" ON public.stock_movements;

CREATE POLICY "Full access on fairs"
ON public.fairs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access on authors"
ON public.authors FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access on books"
ON public.books FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access on sales"
ON public.sales FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access on sale_items"
ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Full access on stock_movements"
ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

