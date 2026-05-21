-- 商品DB / OrderBoard 共通のNE系情報カラム
-- 既に存在する場合は何もしません。

alter table public.products
add column if not exists free_stock integer,
add column if not exists reorder_point integer,
add column if not exists stock_constant integer,
add column if not exists monthly_sales jsonb,
add column if not exists orderboard_classification text;

alter table public.products
alter column orderboard_classification set default 'NOR';

update public.products
set orderboard_classification = 'NOR'
where orderboard_classification is null
   or orderboard_classification = '';
