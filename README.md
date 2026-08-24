# 発注レシピ再読込修正

## 適用
1. 前回の発注レシピSQLを実行済みなら、Supabase SQL Editorで `supabase/rakumart_order_recipe_reload_fix.sql` のみ実行。
2. `src/App.tsx` を差し替え。
3. デプロイ。

## 修正内容
- 読込をPostgRESTの4階層ネストSELECTから `get_rakumart_order_recipe` RPCへ変更。
- 保存後にDBから即再読込し、永続化を確認してから「保存しました」と表示。
- authenticatedロールの4テーブル権限を明示。
