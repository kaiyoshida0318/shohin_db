-- 紙出しソート用の「サブ商品」フラグ。
-- true の商品でも、納品書上の単価が0円のときだけ代表棚番号の判定から除外する。
-- その注文がサブ0円商品のみで構成される場合は、kamidashitool 側で全商品にフォールバックする。

alter table public.products
  add column if not exists paper_sort_sub boolean not null default false;

comment on column public.products.paper_sort_sub is
  '紙出しソート用サブ商品。true かつ納品書単価0円の明細は、他の対象商品がある場合のみ代表棚番号の判定から除外する。';
