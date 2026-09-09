-- NE受注明細の商品名へ追記する物流判定文字列
-- 画面表示名: 配送方-階数

alter table public.products
add column if not exists shipping_floor text;

comment on column public.products.shipping_floor is
  'NE受注明細の商品名へ不足時に追記する文字列（画面表示: 配送方-階数）。例: PKT2-3F, NP-2F, TAK-3F';
