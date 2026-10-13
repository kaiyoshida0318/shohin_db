-- ラクマート発注レシピ v4
-- 既存環境：このSQLだけ実行すればOKです（何度実行しても大丈夫です）。
-- 新規環境：rakumart_order_recipes.sql → このSQL の順に実行してください。
-- ※ v4 適用後に rakumart_order_recipe_reload_fix.sql を実行しないでください（読込関数が v3 に戻ります）。
--    間違えて実行した場合は、このSQLをもう一度実行すれば元に戻ります。
--
-- 追加内容
--   1. 構成品（rakumart_order_items）
--        role       : main = 本体 / accessory = 付属品
--                     入庫一括は、入庫数をどの便に数えるかを本体の行だけで決めます。
--        share_mode : separate = 分ける / merge = まとめる
--                     同じ回に同じ仕入先・同じ規格を使う商品があったときの扱い。
--                     分ける  … その商品どうしは別の注文にする（初期値。ラクマートのセットミス防止）
--                     まとめる … 同じ注文の1行にまとめ、使う全商品の備考を入れる（爪切りのやすり・ケース型）
--   2. 明細（rakumart_order_lines）
--        round_multiple : 倍数（例 500 → 500の倍数に切り上げ）
--        min_quantity   : 最低数量（最低ロット）
--   3. 発注記録（rakumart_order_records）
--        Playwright が注文詳細で番号を振られた行ごとに記録します。
--        入庫一括はこの数量倍率で費用を按分し、単価は値段の推移に使います。
--   4. 備考テンプレートの差し込み
--        remark_template に {構成品名} / {構成品名:規格値} / {数量} を書けます。
--        ●商品コード▲日付-数量 は Playwright が末尾に自動で付けます。

-- ---------------------------------------------------------------------
-- 1. 構成品
-- 初回だけ：v4 より前に保存したレシピは、1番目の構成品を本体、2番目以降を付属品にする
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rakumart_order_items' and column_name = 'role'
  ) then
    alter table public.rakumart_order_items add column role text not null default 'main';
    update public.rakumart_order_items
      set role = case when sort_order = 1 then 'main' else 'accessory' end;
  end if;
end $$;

alter table public.rakumart_order_items
  add column if not exists share_mode text not null default 'separate';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rakumart_order_items_role_check'
  ) then
    alter table public.rakumart_order_items
      add constraint rakumart_order_items_role_check check (role in ('main', 'accessory'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'rakumart_order_items_share_mode_check'
  ) then
    alter table public.rakumart_order_items
      add constraint rakumart_order_items_share_mode_check check (share_mode in ('separate', 'merge'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. 明細
alter table public.rakumart_order_lines
  add column if not exists round_multiple numeric(12,4),
  add column if not exists min_quantity numeric(12,4);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rakumart_order_lines_round_multiple_check'
  ) then
    alter table public.rakumart_order_lines
      add constraint rakumart_order_lines_round_multiple_check
        check (round_multiple is null or (round_multiple > 0 and round_multiple = trunc(round_multiple)));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'rakumart_order_lines_min_quantity_check'
  ) then
    alter table public.rakumart_order_lines
      add constraint rakumart_order_lines_min_quantity_check
        check (min_quantity is null or (min_quantity > 0 and min_quantity = trunc(min_quantity)));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. 発注記録
create table if not exists public.rakumart_order_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,                         -- Playwright の1回の実行
  rakumart_order_no text not null,              -- 注文NO（配送依頼書の「注文番号」）
  line_no integer not null,                     -- 注文詳細の No（配送依頼書の「商品番号」）
  product_code text not null,                   -- この行を使う商品（共有行は商品ごとに1レコード）
  item_name text,                               -- レシピの構成品名
  role text not null default 'main' check (role in ('main', 'accessory')),
  quantity_multiplier numeric(12,4) not null check (quantity_multiplier > 0), -- NEの1単位あたりの使用数（入数）
  order_quantity numeric(12,4) not null,        -- オーダー数（NEの単位）
  product_quantity numeric(12,4) not null,      -- この商品の使用数（オーダー数 × 倍率）
  line_quantity numeric(12,4),                  -- 行全体の発注数（丸め・まとめ後）
  order_token text,                             -- ●商品コード▲日付-数量
  source_url text,
  options jsonb not null default '[]'::jsonb,
  unit_price_cny numeric(12,4),                 -- 注文詳細の単価（元）
  status text not null default 'temporary'
    check (status in ('temporary', 'submitted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rakumart_order_no, line_no, product_code)
);

create index if not exists rakumart_order_records_order_no_idx
  on public.rakumart_order_records(rakumart_order_no, line_no);
create index if not exists rakumart_order_records_product_code_idx
  on public.rakumart_order_records(product_code, created_at desc);

alter table public.rakumart_order_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rakumart_order_records'
      and policyname = 'authenticated_all_rakumart_order_records'
  ) then
    create policy authenticated_all_rakumart_order_records
      on public.rakumart_order_records
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant select, insert, update, delete on table public.rakumart_order_records to authenticated;

drop trigger if exists rakumart_order_records_touch_updated_at
  on public.rakumart_order_records;

create trigger rakumart_order_records_touch_updated_at
before update on public.rakumart_order_records
for each row
execute function public.touch_rakumart_order_recipe_updated_at();

-- 発注記録をまとめて保存（同じ 注文NO・No・商品コード は上書き。
-- 単価・状態・行全体の数量などを省略した再記録では、保存済みの値を残す）
create or replace function public.record_rakumart_order_lines(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    insert into public.rakumart_order_records (
      run_id, rakumart_order_no, line_no, product_code, item_name, role,
      quantity_multiplier, order_quantity, product_quantity, line_quantity,
      order_token, source_url, options, unit_price_cny, status
    ) values (
      (v_row->>'run_id')::uuid,
      btrim(v_row->>'rakumart_order_no'),
      (v_row->>'line_no')::integer,
      btrim(v_row->>'product_code'),
      nullif(btrim(coalesce(v_row->>'item_name', '')), ''),
      coalesce(nullif(v_row->>'role', ''), 'main'),
      (v_row->>'quantity_multiplier')::numeric,
      (v_row->>'order_quantity')::numeric,
      (v_row->>'product_quantity')::numeric,
      nullif(v_row->>'line_quantity', '')::numeric,
      nullif(v_row->>'order_token', ''),
      nullif(v_row->>'source_url', ''),
      coalesce(v_row->'options', '[]'::jsonb),
      nullif(v_row->>'unit_price_cny', '')::numeric,
      coalesce(nullif(v_row->>'status', ''), 'temporary')
    )
    on conflict (rakumart_order_no, line_no, product_code) do update set
      run_id = excluded.run_id,
      item_name = coalesce(excluded.item_name, rakumart_order_records.item_name),
      role = case when v_row ? 'role' then excluded.role else rakumart_order_records.role end,
      quantity_multiplier = excluded.quantity_multiplier,
      order_quantity = excluded.order_quantity,
      product_quantity = excluded.product_quantity,
      line_quantity = coalesce(excluded.line_quantity, rakumart_order_records.line_quantity),
      order_token = coalesce(excluded.order_token, rakumart_order_records.order_token),
      source_url = coalesce(excluded.source_url, rakumart_order_records.source_url),
      options = case when v_row ? 'options' then excluded.options else rakumart_order_records.options end,
      unit_price_cny = coalesce(excluded.unit_price_cny, rakumart_order_records.unit_price_cny),
      status = case when v_row ? 'status' then excluded.status else rakumart_order_records.status end;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.record_rakumart_order_lines(jsonb) to authenticated;

-- 値段の推移（仕入先URL・規格ごとの単価）
create or replace view public.rakumart_price_history
with (security_invoker = true)
as
select
  source_url,
  options,
  product_code,
  item_name,
  rakumart_order_no,
  line_no,
  unit_price_cny,
  created_at
from public.rakumart_order_records
where unit_price_cny is not null
  and status <> 'cancelled';

grant select on public.rakumart_price_history to authenticated;

-- ---------------------------------------------------------------------
-- 4. 保存・読込・実行プラン

create or replace function public.save_rakumart_order_recipe(
  p_product_code text,
  p_recipe jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_item jsonb;
  v_source jsonb;
  v_line jsonb;
  v_item_id uuid;
  v_source_id uuid;
  v_item_order integer := 0;
  v_source_order integer;
  v_line_order integer;
  v_role text;
  v_share text;
  v_round numeric;
  v_min numeric;
begin
  if p_product_code is null or btrim(p_product_code) = '' then
    raise exception 'product_code is required';
  end if;

  insert into public.rakumart_order_recipes (
    product_code,
    enabled,
    stop_before_submit,
    remark_mode,
    remark_template
  ) values (
    p_product_code,
    coalesce((p_recipe->>'enabled')::boolean, false),
    coalesce((p_recipe->>'stop_before_submit')::boolean, true),
    coalesce(nullif(p_recipe->>'remark_mode', ''), 'manual'),
    nullif(btrim(coalesce(p_recipe->>'remark_template', '')), '')
  )
  on conflict (product_code) do update set
    enabled = excluded.enabled,
    stop_before_submit = excluded.stop_before_submit,
    remark_mode = excluded.remark_mode,
    remark_template = excluded.remark_template
  returning id into v_recipe_id;

  delete from public.rakumart_order_items
  where recipe_id = v_recipe_id;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_recipe->'items', '[]'::jsonb))
  loop
    v_item_order := v_item_order + 1;

    if nullif(btrim(coalesce(v_item->>'item_name', '')), '') is null then
      raise exception 'item_name is required at item %', v_item_order;
    end if;

    v_role := coalesce(nullif(v_item->>'role', ''), case when v_item_order = 1 then 'main' else 'accessory' end);
    v_share := coalesce(nullif(v_item->>'share_mode', ''), 'separate');

    insert into public.rakumart_order_items (
      recipe_id,
      item_name,
      sort_order,
      required,
      memo,
      role,
      share_mode
    ) values (
      v_recipe_id,
      btrim(v_item->>'item_name'),
      v_item_order,
      coalesce((v_item->>'required')::boolean, true),
      nullif(btrim(coalesce(v_item->>'memo', '')), ''),
      v_role,
      v_share
    )
    returning id into v_item_id;

    v_source_order := 0;

    for v_source in
      select value
      from jsonb_array_elements(coalesce(v_item->'sources', '[]'::jsonb))
    loop
      v_source_order := v_source_order + 1;

      if nullif(btrim(coalesce(v_source->>'url', '')), '') is null then
        raise exception 'source url is required at item %, source %', v_item_order, v_source_order;
      end if;

      insert into public.rakumart_order_sources (
        item_id,
        source_name,
        url,
        priority,
        enabled,
        memo
      ) values (
        v_item_id,
        nullif(btrim(coalesce(v_source->>'source_name', '')), ''),
        btrim(v_source->>'url'),
        v_source_order,
        coalesce((v_source->>'enabled')::boolean, true),
        nullif(btrim(coalesce(v_source->>'memo', '')), '')
      )
      returning id into v_source_id;

      v_line_order := 0;

      for v_line in
        select value
        from jsonb_array_elements(coalesce(v_source->'lines', '[]'::jsonb))
      loop
        v_line_order := v_line_order + 1;

        if coalesce((v_line->>'quantity_multiplier')::numeric, 0) <= 0 then
          raise exception 'quantity_multiplier must be greater than 0 at item %, source %, line %',
            v_item_order, v_source_order, v_line_order;
        end if;

        v_round := nullif(v_line->>'round_multiple', '')::numeric;
        v_min := nullif(v_line->>'min_quantity', '')::numeric;
        if v_round is not null and v_round <= 0 then
          raise exception 'round_multiple must be greater than 0 at item %, source %, line %',
            v_item_order, v_source_order, v_line_order;
        end if;
        if v_min is not null and v_min <= 0 then
          raise exception 'min_quantity must be greater than 0 at item %, source %, line %',
            v_item_order, v_source_order, v_line_order;
        end if;

        insert into public.rakumart_order_lines (
          source_id,
          options,
          quantity_multiplier,
          sort_order,
          memo,
          round_multiple,
          min_quantity
        ) values (
          v_source_id,
          coalesce(v_line->'options', '[]'::jsonb),
          (v_line->>'quantity_multiplier')::numeric,
          v_line_order,
          nullif(btrim(coalesce(v_line->>'memo', '')), ''),
          v_round,
          v_min
        );
      end loop;
    end loop;
  end loop;

  return v_recipe_id;
end;
$$;

grant execute on function public.save_rakumart_order_recipe(text, jsonb) to authenticated;

create or replace function public.get_rakumart_order_recipe(
  p_product_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recipe jsonb;
begin
  if p_product_code is null or btrim(p_product_code) = '' then
    raise exception 'product_code is required';
  end if;

  select jsonb_build_object(
    'enabled', r.enabled,
    'stop_before_submit', r.stop_before_submit,
    'remark_mode', r.remark_mode,
    'remark_template', r.remark_template,
    'rakumart_order_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_name', i.item_name,
          'sort_order', i.sort_order,
          'required', i.required,
          'memo', i.memo,
          'role', i.role,
          'share_mode', i.share_mode,
          'rakumart_order_sources', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'source_name', s.source_name,
                'url', s.url,
                'priority', s.priority,
                'enabled', s.enabled,
                'memo', s.memo,
                'rakumart_order_lines', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'options', l.options,
                      'quantity_multiplier', l.quantity_multiplier,
                      'round_multiple', l.round_multiple,
                      'min_quantity', l.min_quantity,
                      'sort_order', l.sort_order,
                      'memo', l.memo
                    )
                    order by l.sort_order
                  )
                  from public.rakumart_order_lines l
                  where l.source_id = s.id
                ), '[]'::jsonb)
              )
              order by s.priority
            )
            from public.rakumart_order_sources s
            where s.item_id = i.id
          ), '[]'::jsonb)
        )
        order by i.sort_order
      )
      from public.rakumart_order_items i
      where i.recipe_id = r.id
    ), '[]'::jsonb)
  )
  into v_recipe
  from public.rakumart_order_recipes r
  where r.product_code = p_product_code;

  return v_recipe;
end;
$$;

grant execute on function public.get_rakumart_order_recipe(text) to authenticated;

-- 数量の丸め：倍率をかけた数を整数に切り上げ → 最低数量まで引き上げ → 倍数に切り上げ
create or replace function public.rakumart_round_quantity(
  p_raw numeric,
  p_round_multiple numeric,
  p_min_quantity numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_round_multiple is not null and p_round_multiple > 0
      then ceil(greatest(ceil(p_raw), coalesce(p_min_quantity, 0)) / p_round_multiple) * p_round_multiple
    else greatest(ceil(p_raw), ceil(coalesce(p_min_quantity, 0)))
  end
$$;

grant execute on function public.rakumart_round_quantity(numeric, numeric, numeric) to authenticated;

-- Playwright / OrderBoard 向け実行プラン
--   quantity_raw … オーダー数 × 倍率（この商品が使う数。発注記録・原価按分に使う）
--   quantity     … quantity_raw を丸めた発注数（この商品だけで1行にする場合）
--   share_mode = merge の行を複数商品でまとめるときは、各商品の quantity_raw を合計してから
--   rakumart_round_quantity で丸め直してください。
create or replace function public.get_rakumart_order_execution_plan(
  p_product_code text,
  p_order_quantity numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plan jsonb;
begin
  if p_product_code is null or btrim(p_product_code) = '' then
    raise exception 'product_code is required';
  end if;

  if p_order_quantity is null or p_order_quantity <= 0 then
    raise exception 'order_quantity must be greater than 0';
  end if;

  select jsonb_build_object(
    'recipe_id', r.id,
    'product_code', r.product_code,
    'order_quantity', p_order_quantity,
    'stop_before_submit', r.stop_before_submit,
    'remark_mode', r.remark_mode,
    'remark_template', r.remark_template,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_id', i.id,
          'item_name', i.item_name,
          'required', i.required,
          'role', i.role,
          'share_mode', i.share_mode,
          'memo', i.memo,
          'sort_order', i.sort_order,
          'sources', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'source_id', s.id,
                'source_name', s.source_name,
                'url', s.url,
                'priority', s.priority,
                'memo', s.memo,
                'lines', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'line_id', l.id,
                      'options', l.options,
                      'quantity_multiplier', l.quantity_multiplier,
                      'round_multiple', l.round_multiple,
                      'min_quantity', l.min_quantity,
                      'quantity_raw', l.quantity_multiplier * p_order_quantity,
                      'quantity', public.rakumart_round_quantity(
                        l.quantity_multiplier * p_order_quantity, l.round_multiple, l.min_quantity),
                      'sort_order', l.sort_order,
                      'memo', l.memo
                    )
                    order by l.sort_order
                  )
                  from public.rakumart_order_lines l
                  where l.source_id = s.id
                ), '[]'::jsonb)
              )
              order by s.priority
            )
            from public.rakumart_order_sources s
            where s.item_id = i.id
              and s.enabled = true
          ), '[]'::jsonb)
        )
        order by i.sort_order
      )
      from public.rakumart_order_items i
      where i.recipe_id = r.id
    ), '[]'::jsonb)
  )
  into v_plan
  from public.rakumart_order_recipes r
  where r.product_code = p_product_code
    and r.enabled = true;

  if v_plan is null then
    raise exception 'enabled Rakumart order recipe not found for product_code: %', p_product_code;
  end if;

  return v_plan;
end;
$$;

grant execute on function public.get_rakumart_order_execution_plan(text, numeric) to authenticated;

-- PostgREST のスキーマキャッシュを更新
notify pgrst, 'reload schema';
