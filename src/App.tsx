import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

type Product = {
  product_code: string
  product_name: string | null
  floor: string | null

  order_memo_1: string | null
  rakumart_url_1: string | null
  order_memo_2: string | null
  rakumart_url_2: string | null
  order_memo_3: string | null
  rakumart_url_3: string | null
  order_memo_4: string | null
  rakumart_url_4: string | null
  order_memo_5: string | null
  rakumart_url_5: string | null

  product_info_synced_at: string | null
  order_status_synced_at: string | null
  created_at: string | null
  updated_at: string | null
}

type SessionUser = {
  email?: string
}

const emptyForm = {
  product_code: '',
  product_name: '',
  floor: '',

  order_memo_1: '',
  rakumart_url_1: '',
  order_memo_2: '',
  rakumart_url_2: '',
  order_memo_3: '',
  rakumart_url_3: '',
  order_memo_4: '',
  rakumart_url_4: '',
  order_memo_5: '',
  rakumart_url_5: '',
}

const emptyCreateForm = {
  product_code: '',
  product_name: '',
  floor: '',
}

type ProductForm = typeof emptyForm
type CreateForm = typeof emptyCreateForm
type CreateTab = 'single' | 'bulk'

type BulkProductRow = {
  product_code: string
  product_name: string
  floor: string
}

type BulkParseResult = {
  rows: BulkProductRow[]
  invalidLines: number[]
  duplicateCodes: string[]
}

function formatDateTime(value: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('ja-JP')
}

function RakumartButton({ url }: { url: string | null }) {
  if (!url) return <span className="empty-url">-</span>

  return (
    <a className="url-button" href={url} target="_blank" rel="noreferrer">
      開く
    </a>
  )
}

function splitBulkLine(line: string) {
  const cells = line.includes('\t') ? line.split('\t') : line.split(',')
  return cells.map((cell) => cell.trim())
}

function parseBulkProducts(text: string): BulkParseResult {
  const rows: BulkProductRow[] = []
  const invalidLines: number[] = []
  const duplicateCodeSet = new Set<string>()
  const seenCodeSet = new Set<string>()

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const cells = splitBulkLine(line)

    const firstCell = (cells[0] ?? '').toLowerCase()

    if (
      index === 0 &&
      ['product_code', '商品コード', '商品番号', 'code'].includes(firstCell)
    ) {
      return
    }

    const productCode = cells[0]?.trim() ?? ''
    const productName = cells[1]?.trim() ?? ''
    const floor = cells[2]?.trim() ?? ''

    if (!productCode) {
      invalidLines.push(lineNumber)
      return
    }

    if (seenCodeSet.has(productCode)) {
      duplicateCodeSet.add(productCode)
      return
    }

    seenCodeSet.add(productCode)

    rows.push({
      product_code: productCode,
      product_name: productName,
      floor,
    })
  })

  return {
    rows,
    invalidLines,
    duplicateCodes: Array.from(duplicateCodeSet),
  }
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [keyword, setKeyword] = useState('')
  const [floorFilter, setFloorFilter] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createTab, setCreateTab] = useState<CreateTab>('single')
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm)
  const [bulkText, setBulkText] = useState('')
  const [modalMessage, setModalMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      fetchProducts()
    }
  }, [user])

  const existingProductCodes = useMemo(() => {
    return new Set(products.map((product) => product.product_code))
  }, [products])

  const floors = useMemo(() => {
    const floorSet = new Set<string>()

    products.forEach((product) => {
      if (product.floor) {
        floorSet.add(product.floor)
      }
    })

    return Array.from(floorSet).sort()
  }, [products])

  const bulkPreview = useMemo(() => {
    return parseBulkProducts(bulkText)
  }, [bulkText])

  const bulkExistingCount = useMemo(() => {
    return bulkPreview.rows.filter((row) =>
      existingProductCodes.has(row.product_code),
    ).length
  }, [bulkPreview.rows, existingProductCodes])

  const bulkInsertableCount = bulkPreview.rows.length - bulkExistingCount

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase()

    return products.filter((product) => {
      const matchesKeyword =
        !q ||
        [
          product.product_code,
          product.product_name,
          product.floor,
          product.order_memo_1,
          product.rakumart_url_1,
          product.order_memo_2,
          product.rakumart_url_2,
          product.order_memo_3,
          product.rakumart_url_3,
          product.order_memo_4,
          product.rakumart_url_4,
          product.order_memo_5,
          product.rakumart_url_5,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))

      const matchesFloor = !floorFilter || product.floor === floorFilter

      return matchesKeyword && matchesFloor
    })
  }, [products, keyword, floorFilter])

  async function login() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(`ログイン失敗: ${error.message}`)
    }

    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    setProducts([])
    setUser(null)
  }

  async function fetchProducts() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('product_code', { ascending: true })

    if (error) {
      setMessage(`取得失敗: ${error.message}`)
    } else {
      setProducts((data ?? []) as Product[])
    }

    setLoading(false)
  }

  async function copyProductCode(productCode: string) {
    try {
      await navigator.clipboard.writeText(productCode)
      setMessage(`商品コードをコピーしました：${productCode}`)
    } catch {
      setMessage('コピーに失敗しました。')
    }
  }

  function openCreateModal(tab: CreateTab = 'single') {
    setCreateTab(tab)
    setCreateForm(emptyCreateForm)
    setBulkText('')
    setModalMessage('')
    setIsCreateModalOpen(true)
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false)
    setCreateForm(emptyCreateForm)
    setBulkText('')
    setModalMessage('')
  }

  function clearEditing() {
    setEditingProduct(null)
    setForm(emptyForm)
    setMessage('')
  }

  function startEdit(product: Product) {
    setEditingProduct(product)
    setMessage('')

    setForm({
      product_code: product.product_code ?? '',
      product_name: product.product_name ?? '',
      floor: product.floor ?? '',

      order_memo_1: product.order_memo_1 ?? '',
      rakumart_url_1: product.rakumart_url_1 ?? '',
      order_memo_2: product.order_memo_2 ?? '',
      rakumart_url_2: product.rakumart_url_2 ?? '',
      order_memo_3: product.order_memo_3 ?? '',
      rakumart_url_3: product.rakumart_url_3 ?? '',
      order_memo_4: product.order_memo_4 ?? '',
      rakumart_url_4: product.rakumart_url_4 ?? '',
      order_memo_5: product.order_memo_5 ?? '',
      rakumart_url_5: product.rakumart_url_5 ?? '',
    })
  }

  function updateForm(key: keyof ProductForm, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function updateCreateForm(key: keyof CreateForm, value: string) {
    setCreateForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function createSingleProduct() {
    const productCode = createForm.product_code.trim()

    if (!productCode) {
      setModalMessage('商品コードは必須です。')
      return
    }

    if (existingProductCodes.has(productCode)) {
      setModalMessage(`既存の商品コードです：${productCode}`)
      return
    }

    setLoading(true)
    setModalMessage('')

    const { error } = await supabase.from('products').insert({
      product_code: productCode,
      product_name: createForm.product_name.trim() || null,
      floor: createForm.floor.trim() || null,
    })

    if (error) {
      setModalMessage(`追加失敗: ${error.message}`)
    } else {
      closeCreateModal()
      setMessage(`商品を追加しました：${productCode}`)
      await fetchProducts()
    }

    setLoading(false)
  }

  async function createBulkProducts() {
    const rows = bulkPreview.rows

    if (rows.length === 0) {
      setModalMessage('追加できる商品がありません。')
      return
    }

    const insertRows = rows.filter(
      (row) => !existingProductCodes.has(row.product_code),
    )

    if (insertRows.length === 0) {
      setModalMessage('すべて既存商品コードのため、追加対象がありません。')
      return
    }

    setLoading(true)
    setModalMessage('')

    const payload = insertRows.map((row) => ({
      product_code: row.product_code,
      product_name: row.product_name || null,
      floor: row.floor || null,
    }))

    const { error } = await supabase.from('products').insert(payload)

    if (error) {
      setModalMessage(`一括追加失敗: ${error.message}`)
    } else {
      closeCreateModal()
      setMessage(
        `${insertRows.length}件追加しました。既存商品のスキップ：${bulkExistingCount}件`,
      )
      await fetchProducts()
    }

    setLoading(false)
  }

  async function saveProduct() {
    if (!form.product_code.trim()) {
      setMessage('商品コードは必須です。')
      return
    }

    setLoading(true)
    setMessage('')

    const payload = {
      product_code: form.product_code.trim(),
      product_name: form.product_name.trim() || null,
      floor: form.floor.trim() || null,

      order_memo_1: form.order_memo_1.trim() || null,
      rakumart_url_1: form.rakumart_url_1.trim() || null,
      order_memo_2: form.order_memo_2.trim() || null,
      rakumart_url_2: form.rakumart_url_2.trim() || null,
      order_memo_3: form.order_memo_3.trim() || null,
      rakumart_url_3: form.rakumart_url_3.trim() || null,
      order_memo_4: form.order_memo_4.trim() || null,
      rakumart_url_4: form.rakumart_url_4.trim() || null,
      order_memo_5: form.order_memo_5.trim() || null,
      rakumart_url_5: form.rakumart_url_5.trim() || null,
    }

    const request = editingProduct
      ? supabase
          .from('products')
          .update(payload)
          .eq('product_code', editingProduct.product_code)
      : supabase.from('products').insert(payload)

    const { error } = await request

    if (error) {
      setMessage(`保存失敗: ${error.message}`)
    } else {
      setMessage('保存しました。')
      setEditingProduct(null)
      setForm(emptyForm)
      await fetchProducts()
    }

    setLoading(false)
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div>
            <p className="eyebrow">shohin_db</p>
            <h1>商品DB管理</h1>
            <p className="description">
              社内の商品データベースを検索・確認・編集する管理画面です。
            </p>
          </div>

          <div className="form-stack">
            <label>
              メールアドレス
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>

            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
              />
            </label>

            <button onClick={login} disabled={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>

            {message && <p className="message">{message}</p>}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">shohin_db</p>
          <h1>商品DB管理</h1>
        </div>

        <div className="topbar-actions">
          <span>{user.email}</span>
          <button className="secondary" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      <section className="toolbar">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="商品コード・商品名・発注メモ・ラクマートURLで検索"
        />

        <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
          <option value="">全フロア</option>
          {floors.map((floor) => (
            <option key={floor} value={floor}>
              {floor}
            </option>
          ))}
        </select>

        <button onClick={fetchProducts} disabled={loading}>
          再読み込み
        </button>

        <button onClick={() => openCreateModal('single')}>新規追加</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="layout">
        <div className="table-card">
          <div className="table-header">
            <strong>商品一覧</strong>
            <span>{filteredProducts.length}件</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>商品コード</th>
                  <th>商品名</th>
                  <th>階数</th>
                  <th>発注1</th>
                  <th>ラクマート1</th>
                  <th>発注2</th>
                  <th>ラクマート2</th>
                  <th>発注3</th>
                  <th>ラクマート3</th>
                  <th>発注4</th>
                  <th>ラクマート4</th>
                  <th>発注5</th>
                  <th>ラクマート5</th>
                  <th>商品同期</th>
                  <th>発注同期</th>
                  <th>更新日</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const isEditing =
                    editingProduct?.product_code === product.product_code

                  return (
                    <tr
                      key={product.product_code}
                      className={isEditing ? 'is-editing' : ''}
                    >
                      <td className="code">
                        <button
                          type="button"
                          className="code-copy"
                          onClick={() => copyProductCode(product.product_code)}
                          title="商品コードをコピー"
                        >
                          {product.product_code}
                        </button>
                      </td>
                      <td>{product.product_name}</td>
                      <td>{product.floor}</td>

                      <td>{product.order_memo_1}</td>
                      <td>
                        <RakumartButton url={product.rakumart_url_1} />
                      </td>

                      <td>{product.order_memo_2}</td>
                      <td>
                        <RakumartButton url={product.rakumart_url_2} />
                      </td>

                      <td>{product.order_memo_3}</td>
                      <td>
                        <RakumartButton url={product.rakumart_url_3} />
                      </td>

                      <td>{product.order_memo_4}</td>
                      <td>
                        <RakumartButton url={product.rakumart_url_4} />
                      </td>

                      <td>{product.order_memo_5}</td>
                      <td>
                        <RakumartButton url={product.rakumart_url_5} />
                      </td>

                      <td>{formatDateTime(product.product_info_synced_at)}</td>
                      <td>{formatDateTime(product.order_status_synced_at)}</td>
                      <td>{formatDateTime(product.updated_at)}</td>
                      <td>
                        <button className="small" onClick={() => startEdit(product)}>
                          編集
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={17} className="empty">
                      商品がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="edit-card">
          {editingProduct ? (
            <>
              <div className="edit-card-head">
                <h2>商品編集</h2>
                <button className="secondary small" onClick={clearEditing}>
                  解除
                </button>
              </div>

              <label>
                商品コード
                <input
                  value={form.product_code}
                  onChange={(e) => updateForm('product_code', e.target.value)}
                />
              </label>

              <label>
                商品名
                <input
                  value={form.product_name}
                  onChange={(e) => updateForm('product_name', e.target.value)}
                />
              </label>

              <label>
                階数
                <input
                  value={form.floor}
                  onChange={(e) => updateForm('floor', e.target.value)}
                  placeholder="3F など"
                />
              </label>

              <div className="order-edit-grid">
                <label>
                  発注1
                  <input
                    value={form.order_memo_1}
                    onChange={(e) => updateForm('order_memo_1', e.target.value)}
                    placeholder="0513-100"
                  />
                </label>

                <label>
                  ラクマートURL1
                  <input
                    value={form.rakumart_url_1}
                    onChange={(e) => updateForm('rakumart_url_1', e.target.value)}
                  />
                </label>

                <label>
                  発注2
                  <input
                    value={form.order_memo_2}
                    onChange={(e) => updateForm('order_memo_2', e.target.value)}
                    placeholder="0513-100"
                  />
                </label>

                <label>
                  ラクマートURL2
                  <input
                    value={form.rakumart_url_2}
                    onChange={(e) => updateForm('rakumart_url_2', e.target.value)}
                  />
                </label>

                <label>
                  発注3
                  <input
                    value={form.order_memo_3}
                    onChange={(e) => updateForm('order_memo_3', e.target.value)}
                    placeholder="0513-100"
                  />
                </label>

                <label>
                  ラクマートURL3
                  <input
                    value={form.rakumart_url_3}
                    onChange={(e) => updateForm('rakumart_url_3', e.target.value)}
                  />
                </label>

                <label>
                  発注4
                  <input
                    value={form.order_memo_4}
                    onChange={(e) => updateForm('order_memo_4', e.target.value)}
                    placeholder="0513-100"
                  />
                </label>

                <label>
                  ラクマートURL4
                  <input
                    value={form.rakumart_url_4}
                    onChange={(e) => updateForm('rakumart_url_4', e.target.value)}
                  />
                </label>

                <label>
                  発注5
                  <input
                    value={form.order_memo_5}
                    onChange={(e) => updateForm('order_memo_5', e.target.value)}
                    placeholder="0513-100"
                  />
                </label>

                <label>
                  ラクマートURL5
                  <input
                    value={form.rakumart_url_5}
                    onChange={(e) => updateForm('rakumart_url_5', e.target.value)}
                  />
                </label>
              </div>

              <div className="edit-actions">
                <button onClick={saveProduct} disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </button>

                <button className="secondary" onClick={clearEditing}>
                  クリア
                </button>
              </div>
            </>
          ) : (
            <div className="edit-placeholder">
              <h2>商品編集</h2>
              <p>一覧の「編集」を押すと、ここで商品情報を編集できます。</p>
              <button onClick={() => openCreateModal('single')}>新規追加</button>
            </div>
          )}
        </aside>
      </section>

      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={closeCreateModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="新規商品追加"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">New Product</p>
                <h2>新規商品追加</h2>
              </div>

              <button className="secondary small" onClick={closeCreateModal}>
                閉じる
              </button>
            </div>

            <div className="modal-tabs">
              <button
                className={createTab === 'single' ? 'tab-button active' : 'tab-button'}
                onClick={() => {
                  setCreateTab('single')
                  setModalMessage('')
                }}
              >
                1件追加
              </button>

              <button
                className={createTab === 'bulk' ? 'tab-button active' : 'tab-button'}
                onClick={() => {
                  setCreateTab('bulk')
                  setModalMessage('')
                }}
              >
                複数行で追加
              </button>
            </div>

            {createTab === 'single' ? (
              <div className="modal-body">
                <label>
                  商品コード
                  <input
                    value={createForm.product_code}
                    onChange={(e) => updateCreateForm('product_code', e.target.value)}
                    placeholder="mus-04"
                  />
                </label>

                <label>
                  商品名
                  <input
                    value={createForm.product_name}
                    onChange={(e) => updateCreateForm('product_name', e.target.value)}
                    placeholder="ストリングクリーナー"
                  />
                </label>

                <label>
                  階数
                  <input
                    value={createForm.floor}
                    onChange={(e) => updateCreateForm('floor', e.target.value)}
                    placeholder="3F"
                  />
                </label>

                {modalMessage && <p className="modal-message">{modalMessage}</p>}

                <div className="modal-actions">
                  <button onClick={createSingleProduct} disabled={loading}>
                    {loading ? '追加中...' : '追加'}
                  </button>
                  <button className="secondary" onClick={closeCreateModal}>
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-body">
                <div className="bulk-guide">
                  <strong>Excelから3列コピーして貼り付け</strong>
                  <pre>{`商品コード\t商品名\t階数
mus-04\tストリングクリーナー\t3F
sb-08-short-04\tショルダーベルト ストライプ 黒 ショート\t3F`}</pre>
                </div>

                <label>
                  貼り付け欄
                  <textarea
                    className="bulk-textarea"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={'商品コード\t商品名\t階数'}
                  />
                </label>

                <div className="bulk-preview">
                  <span>読み取り：{bulkPreview.rows.length}件</span>
                  <span>追加予定：{bulkInsertableCount}件</span>
                  <span>既存スキップ：{bulkExistingCount}件</span>
                  {bulkPreview.duplicateCodes.length > 0 && (
                    <span>貼付内重複：{bulkPreview.duplicateCodes.length}件</span>
                  )}
                  {bulkPreview.invalidLines.length > 0 && (
                    <span>不正行：{bulkPreview.invalidLines.join(', ')}</span>
                  )}
                </div>

                {modalMessage && <p className="modal-message">{modalMessage}</p>}

                <div className="modal-actions">
                  <button
                    onClick={createBulkProducts}
                    disabled={loading || bulkInsertableCount === 0}
                  >
                    {loading ? '一括追加中...' : `${bulkInsertableCount}件を追加`}
                  </button>
                  <button className="secondary" onClick={closeCreateModal}>
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App