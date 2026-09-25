-- シールを最大3枚持てるようにする（商品DBの列名: シール1 / シール2 / シール3）
-- 既存の sticker_color はシール1へコピーする。
-- 「ピ/青1」のように / 区切りで複数入っている値は、シール1〜3へ分割する。
-- 旧 sticker_color 列は、古い kamidashitool.exe が参照しているため当面残す（新しい画面からは更新されない）。

alter table public.products
  add column if not exists sticker_color_1 text,
  add column if not exists sticker_color_2 text,
  add column if not exists sticker_color_3 text;

comment on column public.products.sticker_color_1 is 'シール1（例: 青1 / 赤100 / 黄）';
comment on column public.products.sticker_color_2 is 'シール2';
comment on column public.products.sticker_color_3 is 'シール3';
comment on column public.products.sticker_color is '旧シールカラー（非推奨）。sticker_color_1〜3 を使用する。';

-- 既存データの移行（新しい列がまだ空の商品だけ）
with src as (
  select
    product_code,
    regexp_split_to_array(btrim(sticker_color), '\s*[/／、,，・]\s*') as parts
  from public.products
  where nullif(btrim(sticker_color), '') is not null
    and sticker_color_1 is null
    and sticker_color_2 is null
    and sticker_color_3 is null
)
update public.products p
set
  sticker_color_1 = nullif(btrim(src.parts[1]), ''),
  sticker_color_2 = nullif(btrim(src.parts[2]), ''),
  sticker_color_3 = nullif(btrim(src.parts[3]), '')
from src
where p.product_code = src.product_code;

-- 確認用
-- select product_code, sticker_color, sticker_color_1, sticker_color_2, sticker_color_3
-- from public.products where sticker_color is not null order by product_code;
