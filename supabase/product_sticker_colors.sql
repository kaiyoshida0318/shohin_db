-- シールを最大3枚持てるようにする（商品DBの列名: シール1 / シール2 / シール3）
--
-- 既存の sticker_color（シールカラー）を 1文字=1シール として分割し、シール1〜3へ入れる。
--   黄緑    -> 黄 / 緑
--   赤ピ緑  -> 赤 / ピ / 緑
--   赤緑13  -> 赤 / 緑13      （数字は直前の色にくっつける）
--   ピ/青1  -> ピ / 青1       （/ などの区切りも可）
--   水色    -> 水、黄色 -> 黄 （「色」は落とす）
--
-- 旧 sticker_color 列は、古い kamidashitool.exe が参照しているため当面残す（新しい画面からは更新されない）。
-- 何度実行しても大丈夫（手で直したシール1〜3は上書きしない）。

alter table public.products
  add column if not exists sticker_color_1 text,
  add column if not exists sticker_color_2 text,
  add column if not exists sticker_color_3 text;

comment on column public.products.sticker_color_1 is 'シール1（例: 青1 / 赤100 / 黄）';
comment on column public.products.sticker_color_2 is 'シール2';
comment on column public.products.sticker_color_3 is 'シール3';
comment on column public.products.sticker_color is '旧シールカラー（非推奨）。sticker_color_1〜3 を使用する。';

with src as (
  select
    p.product_code,
    array(
      select regexp_replace(t.m[1], '^(.)色', '\1')
      from regexp_matches(
        btrim(p.sticker_color),
        '([^0-9０-９/／、,，・[:space:]]色?[0-9０-９]*)',
        'g'
      ) with ordinality as t(m, ord)
      order by t.ord
    ) as parts
  from public.products p
  where nullif(btrim(p.sticker_color), '') is not null
    and p.sticker_color_2 is null
    and p.sticker_color_3 is null
    -- 未移行、または前回の移行で丸ごとシール1にコピーされただけの商品
    and (p.sticker_color_1 is null or p.sticker_color_1 = btrim(p.sticker_color))
)
update public.products p
set
  sticker_color_1 = src.parts[1],
  sticker_color_2 = src.parts[2],
  sticker_color_3 = src.parts[3]
from src
where p.product_code = src.product_code;

-- 確認用: 分割結果
-- select sticker_color, sticker_color_1, sticker_color_2, sticker_color_3, count(*)
-- from public.products
-- where nullif(btrim(sticker_color), '') is not null
-- group by 1, 2, 3, 4
-- order by count(*) desc;

-- 確認用: 4枚以上あって4枚目以降が切り捨てられた商品（現状のデータでは0件の想定）
-- select product_code, sticker_color
-- from public.products
-- where (
--   select count(*)
--   from regexp_matches(btrim(sticker_color), '([^0-9０-９/／、,，・[:space:]]色?[0-9０-９]*)', 'g')
-- ) > 3;
