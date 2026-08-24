-- 発注レシピ再読込修正
-- 前回 rakumart_order_recipes.sql を実行済みの場合は、このSQLだけ実行すればOKです。

-- RLSポリシーに加えて authenticated ロールへの権限を明示します。
grant select, insert, update, delete on table public.rakumart_order_recipes to authenticated;
grant select, insert, update, delete on table public.rakumart_order_items to authenticated;
grant select, insert, update, delete on table public.rakumart_order_sources to authenticated;
grant select, insert, update, delete on table public.rakumart_order_lines to authenticated;

-- 編集画面用レシピを1つのJSONとして返します。
-- PostgRESTの4階層ネスト取得に依存しないため、保存と再読込で同じデータ経路を使えます。
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
