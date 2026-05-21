-- monthly_sales が空で、旧カラム monthly_by_year に月別受注数が入っている場合だけコピーします。
-- monthly_by_year カラムが存在しない環境では何もしません。
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'monthly_by_year'
  ) then
    update public.products
    set monthly_sales = monthly_by_year
    where monthly_sales is null
      and monthly_by_year is not null;
  end if;
end $$;
