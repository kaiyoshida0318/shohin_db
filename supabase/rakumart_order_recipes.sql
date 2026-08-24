-- ラクマート自動発注レシピ
-- 既存 products.order_url_1〜3 / order_memo_1〜5 / rakumart_url_1〜5 の役割は変更しません。
-- この4テーブルは Playwright が実行できる構造化された発注設定専用です。

create table if not exists public.rakumart_order_recipes (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique
    references public.products(product_code)
    on update cascade
    on delete cascade,
  enabled boolean not null default false,
  stop_before_submit boolean not null default true,
  remark_mode text not null default 'manual'
    check (remark_mode in ('manual', 'none', 'template')),
  remark_template text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rakumart_order_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null
    references public.rakumart_order_recipes(id)
    on delete cascade,
  item_name text not null,
  sort_order integer not null default 1,
  required boolean not null default true,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.rakumart_order_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null
    references public.rakumart_order_items(id)
    on delete cascade,
  source_name text,
  url text not null,
  priority integer not null default 1,
  enabled boolean not null default true,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.rakumart_order_lines (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references public.rakumart_order_sources(id)
    on delete cascade,
  options jsonb not null default '[]'::jsonb,
  quantity_multiplier numeric(12,4) not null default 1
    check (quantity_multiplier > 0),
  sort_order integer not null default 1,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists rakumart_order_items_recipe_id_idx
  on public.rakumart_order_items(recipe_id, sort_order);

create index if not exists rakumart_order_sources_item_id_idx
  on public.rakumart_order_sources(item_id, priority);

create index if not exists rakumart_order_lines_source_id_idx
  on public.rakumart_order_lines(source_id, sort_order);

-- Supabase Auth でログイン済みのユーザーだけが参照・更新できます。
alter table public.rakumart_order_recipes enable row level security;
alter table public.rakumart_order_items enable row level security;
alter table public.rakumart_order_sources enable row level security;
alter table public.rakumart_order_lines enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rakumart_order_recipes'
      and policyname = 'authenticated_all_rakumart_order_recipes'
  ) then
    create policy authenticated_all_rakumart_order_recipes
      on public.rakumart_order_recipes
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rakumart_order_items'
      and policyname = 'authenticated_all_rakumart_order_items'
  ) then
    create policy authenticated_all_rakumart_order_items
      on public.rakumart_order_items
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rakumart_order_sources'
      and policyname = 'authenticated_all_rakumart_order_sources'
  ) then
    create policy authenticated_all_rakumart_order_sources
      on public.rakumart_order_sources
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rakumart_order_lines'
      and policyname = 'authenticated_all_rakumart_order_lines'
  ) then
    create policy authenticated_all_rakumart_order_lines
      on public.rakumart_order_lines
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

create or replace function public.touch_rakumart_order_recipe_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rakumart_order_recipes_touch_updated_at
  on public.rakumart_order_recipes;

create trigger rakumart_order_recipes_touch_updated_at
before update on public.rakumart_order_recipes
for each row
execute function public.touch_rakumart_order_recipe_updated_at();

-- レシピ一式を1トランザクションで保存します。
-- 既存の子要素は一度削除し、画面の内容を正として再作成します。
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

    insert into public.rakumart_order_items (
      recipe_id,
      item_name,
      sort_order,
      required,
      memo
    ) values (
      v_recipe_id,
      btrim(v_item->>'item_name'),
      v_item_order,
      coalesce((v_item->>'required')::boolean, true),
      nullif(btrim(coalesce(v_item->>'memo', '')), '')
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

        insert into public.rakumart_order_lines (
          source_id,
          options,
          quantity_multiplier,
          sort_order,
          memo
        ) values (
          v_source_id,
          coalesce(v_line->'options', '[]'::jsonb),
          (v_line->>'quantity_multiplier')::numeric,
          v_line_order,
          nullif(btrim(coalesce(v_line->>'memo', '')), '')
        );
      end loop;
    end loop;
  end loop;

  return v_recipe_id;
end;
$$;

grant execute on function public.save_rakumart_order_recipe(text, jsonb) to authenticated;
