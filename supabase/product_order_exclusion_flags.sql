-- 商品DB / OrderBoard 共通の発注除外フラグ
-- Supabase SQL Editor で1回実行してください。

alter table public.products
  add column if not exists order_out boolean not null default false,
  add column if not exists no_1688_shop boolean not null default false;

comment on column public.products.order_out is
  'OrderBoardの一覧・発注対象から除外するフラグ（商品DB表示名: out）';

comment on column public.products.no_1688_shop is
  '1688ショップなし。ON時はOrderBoardの一覧・発注対象から除外する';
