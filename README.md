# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## 紙出し用「4行目」追加

`add_delivery_line_4.sql` をSupabaseのSQL Editorで1回実行してからデプロイしてください。
紙出し用ビューでは、商品名の後に「2行目」「3行目」「4行目」を入力できます。

## 推奨列幅の共有設定

先に `create_app_settings.sql` をSupabaseのSQL Editorで1回実行してください。

ヘッダー右上の歯車から、表示中ビューごとに推奨幅をSupabaseへ共有保存できます。

- 「現在の幅を共有へ反映」：ドラッグ調整した現在幅を共有推奨幅として保存
- 「数値を共有保存」：入力欄で変更した幅を共有推奨幅として保存
- 「共有推奨幅を適用」：Supabaseから取得した推奨幅を現在の表示へ適用

推奨幅は複数PC・複数ブラウザで共有されます。ドラッグ後の現在幅は、これまでどおり各ブラウザのlocalStorageに保存されます。
歯車を開くたびに、表示中ビューの最新の共有推奨幅を取得します。

## ラクマート発注レシピ

Playwright向けの構造化された発注設定を商品ごとに保持できます。
先に `supabase/rakumart_order_recipes.sql` をSupabaseのSQL Editorで1回実行してください。

- 既存の `発注URL1〜3` は人間向けの仕入先参照としてそのまま残します。
- 既存の `オーダー1〜5 / RM1〜5` は過去の発注履歴としてそのまま残します。
- 新しい発注レシピは「構成品 → 仕入先候補 → 発注明細（規格・数量倍率）」で管理します。
- レシピ保存は `save_rakumart_order_recipe` RPCで1トランザクションにまとめています。
- 初期運用は「提出直前で停止」をONにし、最終提出と相対番号を使う備考入力は手動前提です。

## ラクマート発注レシピ

商品一覧の「オーダー用」表示でのみ、各商品の操作欄に `レシピ` ボタンを表示します。
「オーダー状況」「NE情報」「紙出し用」「カスタム」「すべて」では表示しません。

Supabase の `supabase/rakumart_order_recipes.sql` を SQL Editor で実行すると、発注レシピ4テーブルと保存RPCに加えて、Playwright / OrderBoard向けの `get_rakumart_order_execution_plan` RPCが作成されます。

例: 発注予定数30で実行プランを取得

```sql
select public.get_rakumart_order_execution_plan(
  'scarf-24-01-45cm-io',
  30
);
```

返却JSONでは各明細に `quantity_multiplier` と、発注予定数を掛けた `quantity` が含まれます。代替仕入先は `priority` 順で返るため、Playwright側は上から順に利用可否を確認できます。
