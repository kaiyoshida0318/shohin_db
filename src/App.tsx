import { type ClipboardEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

type Product = {
  product_code: string
  product_name: string | null
  floor: string | null

  special_notes: string | null
  picking_advice: string | null
  rack_number: string | null
  rack_level: string | null
  sticker_color: string | null

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

type EditableProduct = {
  product_name: string
  floor: string

  special_notes: string
  picking_advice: string
  rack_number: string
  rack_level: string
  sticker_color: string

  order_memo_1: string
  rakumart_url_1: string
  order_memo_2: string
  rakumart_url_2: string
  order_memo_3: string
  rakumart_url_3: string
  order_memo_4: string
  rakumart_url_4: string
  order_memo_5: string
  rakumart_url_5: string
}

type EditableProductKey = keyof EditableProduct

type SessionUser = {
  email?: string
}

type TableView = 'all' | 'pick' | 'custom'

const emptyCreateForm = {
  product_code: '',
  product_name: '',
  floor: '',
  special_notes: '',
  picking_advice: '',
  rack_number: '',
  rack_level: '',
  sticker_color: '',
}

type CreateForm = typeof emptyCreateForm
type CreateTab = 'single' | 'bulk'

type BulkProductRow = {
  id: string
  product_code: string
  product_name: string
  floor: string
  special_notes: string
  picking_advice: string
  rack_number: string
  rack_level: string
  sticker_color: string
}

type CleanBulkProductRow = {
  product_code: string
  product_name: string
  floor: string
  special_notes: string
  picking_advice: string
  rack_number: string
  rack_level: string
  sticker_color: string
}

type BulkSummary = {
  filledCount: number
  insertRows: CleanBulkProductRow[]
  existingCount: number
  duplicateCodes: string[]
}

const INITIAL_BULK_ROW_COUNT = 10

function createBulkRow(): BulkProductRow {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    product_code: '',
    product_name: '',
    floor: '',
    special_notes: '',
    picking_advice: '',
    rack_number: '',
    rack_level: '',
    sticker_color: '',
  }
}

function createBulkRows(count = INITIAL_BULK_ROW_COUNT): BulkProductRow[] {
  return Array.from({ length: count }, () => createBulkRow())
}

function splitBulkLine(line: string) {
  const cells = line.includes('\t') ? line.split('\t') : line.split(',')
  return cells.map((cell) => cell.trim())
}

function parseClipboardRows(text: string): CleanBulkProductRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines
    .map((line, index) => {
      const cells = splitBulkLine(line)
      const firstCell = (cells[0] ?? '').toLowerCase()

      if (
        index === 0 &&
        ['product_code', '商品コード', '商品番号', 'code'].includes(firstCell)
      ) {
        return null
      }

      return {
        product_code: cells[0]?.trim() ?? '',
        product_name: cells[1]?.trim() ?? '',
        floor: cells[2]?.trim() ?? '',
        rack_number: cells[3]?.trim() ?? '',
        rack_level: cells[4]?.trim() ?? '',
        sticker_color: cells[5]?.trim() ?? '',
        special_notes: cells[6]?.trim() ?? '',
        picking_advice: cells[7]?.trim() ?? '',
      }
    })
    .filter((row): row is CleanBulkProductRow => {
      return Boolean(row?.product_code)
    })
}

function buildBulkSummary(
  rows: BulkProductRow[],
  existingProductCodes: Set<string>,
): BulkSummary {
  const filledRows = rows
    .map((row) => ({
      product_code: row.product_code.trim(),
      product_name: row.product_name.trim(),
      floor: row.floor.trim(),
      special_notes: row.special_notes.trim(),
      picking_advice: row.picking_advice.trim(),
      rack_number: row.rack_number.trim(),
      rack_level: row.rack_level.trim(),
      sticker_color: row.sticker_color.trim(),
    }))
    .filter((row) => row.product_code)

  const seenCodes = new Set<string>()
  const duplicateCodeSet = new Set<string>()
  const uniqueRows: CleanBulkProductRow[] = []

  filledRows.forEach((row) => {
    if (seenCodes.has(row.product_code)) {
      duplicateCodeSet.add(row.product_code)
      return
    }

    seenCodes.add(row.product_code)
    uniqueRows.push(row)
  })

  const existingRows = uniqueRows.filter((row) =>
    existingProductCodes.has(row.product_code),
  )

  const insertRows = uniqueRows.filter(
    (row) => !existingProductCodes.has(row.product_code),
  )

  return {
    filledCount: filledRows.length,
    insertRows,
    existingCount: existingRows.length,
    duplicateCodes: Array.from(duplicateCodeSet),
  }
}

function formatDateTime(value: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('ja-JP')
}

function productToDraft(product: Product): EditableProduct {
  return {
    product_name: product.product_name ?? '',
    floor: product.floor ?? '',
    special_notes: product.special_notes ?? '',
    picking_advice: product.picking_advice ?? '',
    rack_number: product.rack_number ?? '',
    rack_level: product.rack_level ?? '',
    sticker_color: product.sticker_color ?? '',
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
  }
}

function normalizeDraft(draft: EditableProduct) {
  return {
    product_name: draft.product_name.trim() || null,
    floor: draft.floor.trim() || null,
    special_notes: draft.special_notes.trim() || null,
    picking_advice: draft.picking_advice.trim() || null,
    rack_number: draft.rack_number.trim() || null,
    rack_level: draft.rack_level.trim() || null,
    sticker_color: draft.sticker_color.trim() || null,
    order_memo_1: draft.order_memo_1.trim() || null,
    rakumart_url_1: draft.rakumart_url_1.trim() || null,
    order_memo_2: draft.order_memo_2.trim() || null,
    rakumart_url_2: draft.rakumart_url_2.trim() || null,
    order_memo_3: draft.order_memo_3.trim() || null,
    rakumart_url_3: draft.rakumart_url_3.trim() || null,
    order_memo_4: draft.order_memo_4.trim() || null,
    rakumart_url_4: draft.rakumart_url_4.trim() || null,
    order_memo_5: draft.order_memo_5.trim() || null,
    rakumart_url_5: draft.rakumart_url_5.trim() || null,
  }
}

function isDraftDirty(product: Product, draft: EditableProduct) {
  const original = productToDraft(product)

  return (Object.keys(original) as EditableProductKey[]).some(
    (key) => original[key] !== draft[key],
  )
}

function RakumartButton({ url }: { url: string | null }) {
  if (!url) return <span className="empty-url">-</span>

  return (
    <a className="url-button" href={url} target="_blank" rel="noreferrer">
      開く
    </a>
  )
}

function UrlEditCell({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="url-edit-cell">
      <input
        className="table-input url-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="URL"
      />

      {value.trim() ? (
        <a className="url-button" href={value.trim()} target="_blank" rel="noreferrer">
          開く
        </a>
      ) : (
        <span className="empty-url">-</span>
      )}
    </div>
  )
}

function DisplayText({ value, className = '' }: { value: string | null; className?: string }) {
  return <span className={`cell-text ${className}`}>{value || '-'}</span>
}

function ViewButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={active ? 'view-button active' : 'view-button'}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [rowDrafts, setRowDrafts] = useState<Record<string, EditableProduct>>({})
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [floorFilter, setFloorFilter] = useState('')
  const [tableView, setTableView] = useState<TableView>('all')

  const [loading, setLoading] = useState(false)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createTab, setCreateTab] = useState<CreateTab>('single')
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm)
  const [bulkRows, setBulkRows] = useState<BulkProductRow[]>(() =>
    createBulkRows(),
  )
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

  useEffect(() => {
    setRowDrafts((prev) => {
      const nextDrafts: Record<string, EditableProduct> = {}

      products.forEach((product) => {
        nextDrafts[product.product_code] =
          editingCode === product.product_code && prev[product.product_code]
            ? prev[product.product_code]
            : productToDraft(product)
      })

      return nextDrafts
    })
  }, [products, editingCode])

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

  const bulkSummary = useMemo(() => {
    return buildBulkSummary(bulkRows, existingProductCodes)
  }, [bulkRows, existingProductCodes])

  const bulkInsertableCount = bulkSummary.insertRows.length
  const bulkExistingCount = bulkSummary.existingCount

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase()

    return products.filter((product) => {
      const draft =
        editingCode === product.product_code
          ? rowDrafts[product.product_code] ?? productToDraft(product)
          : productToDraft(product)

      const matchesKeyword =
        !q ||
        [
          product.product_code,
          draft.product_name,
          draft.floor,
          draft.special_notes,
          draft.picking_advice,
          draft.rack_number,
          draft.rack_level,
          draft.sticker_color,
          draft.order_memo_1,
          draft.rakumart_url_1,
          draft.order_memo_2,
          draft.rakumart_url_2,
          draft.order_memo_3,
          draft.rakumart_url_3,
          draft.order_memo_4,
          draft.rakumart_url_4,
          draft.order_memo_5,
          draft.rakumart_url_5,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))

      const matchesFloor = !floorFilter || draft.floor === floorFilter

      return matchesKeyword && matchesFloor
    })
  }, [products, rowDrafts, editingCode, keyword, floorFilter])

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
    setRowDrafts({})
    setEditingCode(null)
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
    setBulkRows(createBulkRows())
    setModalMessage('')
    setIsCreateModalOpen(true)
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false)
    setCreateForm(emptyCreateForm)
    setBulkRows(createBulkRows())
    setModalMessage('')
  }

  function updateCreateForm(key: keyof CreateForm, value: string) {
    setCreateForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function updateBulkRow(
    rowId: string,
    key: keyof Omit<BulkProductRow, 'id'>,
    value: string,
  ) {
    setBulkRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    )
  }

  function addBulkRows(count = 5) {
    setBulkRows((prev) => [...prev, ...createBulkRows(count)])
  }

  function removeBulkRow(rowId: string) {
    setBulkRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId)
      return next.length > 0 ? next : createBulkRows(1)
    })
  }

  function clearBulkRows() {
    setBulkRows(createBulkRows())
    setModalMessage('')
  }

  function handleBulkPaste(
    event: ClipboardEvent<HTMLInputElement>,
    startIndex: number,
  ) {
    const text = event.clipboardData.getData('text')

    if (!text.includes('\n') && !text.includes('\t')) {
      return
    }

    const pastedRows = parseClipboardRows(text)

    if (pastedRows.length === 0) {
      return
    }

    event.preventDefault()

    setBulkRows((prev) => {
      const next = [...prev]
      const requiredLength = startIndex + pastedRows.length

      while (next.length < requiredLength) {
        next.push(createBulkRow())
      }

      pastedRows.forEach((pastedRow, offset) => {
        const targetIndex = startIndex + offset

        next[targetIndex] = {
          ...next[targetIndex],
          product_code: pastedRow.product_code,
          product_name: pastedRow.product_name,
          floor: pastedRow.floor,
          rack_number: pastedRow.rack_number,
          rack_level: pastedRow.rack_level,
          sticker_color: pastedRow.sticker_color,
          special_notes: pastedRow.special_notes,
          picking_advice: pastedRow.picking_advice,
        }
      })

      return next
    })
  }

  function startEdit(product: Product) {
    setEditingCode(product.product_code)
    setRowDrafts((prev) => ({
      ...prev,
      [product.product_code]: productToDraft(product),
    }))
    setMessage('')
  }

  function updateDraft(
    productCode: string,
    key: EditableProductKey,
    value: string,
  ) {
    const product = products.find((item) => item.product_code === productCode)

    if (!product) {
      return
    }

    setRowDrafts((prev) => ({
      ...prev,
      [productCode]: {
        ...(prev[productCode] ?? productToDraft(product)),
        [key]: value,
      },
    }))
  }

  function cancelEdit(product: Product) {
    setRowDrafts((prev) => ({
      ...prev,
      [product.product_code]: productToDraft(product),
    }))
    setEditingCode(null)
    setMessage(`編集をキャンセルしました：${product.product_code}`)
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
      special_notes: createForm.special_notes.trim() || null,
      picking_advice: createForm.picking_advice.trim() || null,
      rack_number: createForm.rack_number.trim() || null,
      rack_level: createForm.rack_level.trim() || null,
      sticker_color: createForm.sticker_color.trim() || null,
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
    const insertRows = bulkSummary.insertRows

    if (bulkSummary.filledCount === 0) {
      setModalMessage('追加できる商品がありません。')
      return
    }

    if (insertRows.length === 0) {
      setModalMessage(
        'すべて既存商品コード、または入力内重複のため追加対象がありません。',
      )
      return
    }

    setLoading(true)
    setModalMessage('')

    const payload = insertRows.map((row) => ({
      product_code: row.product_code,
      product_name: row.product_name || null,
      floor: row.floor || null,
      special_notes: row.special_notes || null,
      picking_advice: row.picking_advice || null,
      rack_number: row.rack_number || null,
      rack_level: row.rack_level || null,
      sticker_color: row.sticker_color || null,
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

  async function saveRow(product: Product) {
    const draft = rowDrafts[product.product_code]

    if (!draft) {
      setMessage('保存対象が見つかりません。')
      return
    }

    setSavingCode(product.product_code)
    setMessage('')

    const payload = {
      ...normalizeDraft(draft),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('product_code', product.product_code)

    if (error) {
      setMessage(`保存失敗: ${error.message}`)
    } else {
      setMessage(`保存しました：${product.product_code}`)
      setEditingCode(null)
      await fetchProducts()
    }

    setSavingCode(null)
  }

  function renderTextCell(
    product: Product,
    draft: EditableProduct,
    key: EditableProductKey,
    options: {
      className?: string
      inputClassName?: string
      multiline?: boolean
      placeholder?: string
    } = {},
  ) {
    const isEditing = editingCode === product.product_code

    if (isEditing) {
      if (options.multiline) {
        return (
          <textarea
            className={`table-input table-textarea ${options.inputClassName ?? ''}`}
            value={draft[key]}
            onChange={(event) => updateDraft(product.product_code, key, event.target.value)}
            placeholder={options.placeholder}
          />
        )
      }

      return (
        <input
          className={`table-input ${options.inputClassName ?? ''}`}
          value={draft[key]}
          onChange={(event) => updateDraft(product.product_code, key, event.target.value)}
          placeholder={options.placeholder}
        />
      )
    }

    return <DisplayText value={product[key] ?? null} className={options.className} />
  }

  function renderUrlCell(product: Product, draft: EditableProduct, key: EditableProductKey) {
    const isEditing = editingCode === product.product_code

    if (isEditing) {
      return (
        <UrlEditCell
          value={draft[key]}
          onChange={(value) => updateDraft(product.product_code, key, value)}
        />
      )
    }

    return <RakumartButton url={product[key] ?? null} />
  }

  function renderActions(product: Product, draft: EditableProduct) {
    const isEditing = editingCode === product.product_code
    const dirty = isEditing && isDraftDirty(product, draft)
    const isSaving = savingCode === product.product_code
    const editLocked = Boolean(editingCode) && !isEditing

    if (isEditing) {
      return (
        <div className="row-actions">
          <button
            className="small"
            onClick={() => saveRow(product)}
            disabled={!dirty || isSaving || Boolean(savingCode)}
          >
            {isSaving ? '保存中' : '保存'}
          </button>

          <button
            className="secondary small"
            onClick={() => cancelEdit(product)}
            disabled={isSaving}
          >
            キャンセル
          </button>
        </div>
      )
    }

    return (
      <button
        className="small"
        onClick={() => startEdit(product)}
        disabled={editLocked || Boolean(savingCode)}
      >
        編集
      </button>
    )
  }

  function renderAllColumns(product: Product, draft: EditableProduct) {
    return (
      <>
        <td>{renderTextCell(product, draft, 'product_name', { className: 'product-name-text', inputClassName: 'product-name-input' })}</td>
        <td>{renderTextCell(product, draft, 'floor', { inputClassName: 'floor-input' })}</td>
        <td>{renderTextCell(product, draft, 'special_notes', { className: 'note-text', multiline: true, placeholder: '特記事項' })}</td>
        <td>{renderTextCell(product, draft, 'picking_advice', { className: 'note-text', multiline: true, placeholder: 'ピック時アドバイス' })}</td>
        <td>{renderTextCell(product, draft, 'rack_number', { inputClassName: 'rack-input' })}</td>
        <td>{renderTextCell(product, draft, 'rack_level', { inputClassName: 'rack-level-input' })}</td>
        <td>{renderTextCell(product, draft, 'sticker_color', { inputClassName: 'sticker-input' })}</td>
        <td>{renderTextCell(product, draft, 'order_memo_1', { className: 'mono-text', inputClassName: 'order-input', placeholder: '0513-100' })}</td>
        <td>{renderUrlCell(product, draft, 'rakumart_url_1')}</td>
        <td>{renderTextCell(product, draft, 'order_memo_2', { className: 'mono-text', inputClassName: 'order-input', placeholder: '0513-100' })}</td>
        <td>{renderUrlCell(product, draft, 'rakumart_url_2')}</td>
        <td>{renderTextCell(product, draft, 'order_memo_3', { className: 'mono-text', inputClassName: 'order-input', placeholder: '0513-100' })}</td>
        <td>{renderUrlCell(product, draft, 'rakumart_url_3')}</td>
        <td>{renderTextCell(product, draft, 'order_memo_4', { className: 'mono-text', inputClassName: 'order-input', placeholder: '0513-100' })}</td>
        <td>{renderUrlCell(product, draft, 'rakumart_url_4')}</td>
        <td>{renderTextCell(product, draft, 'order_memo_5', { className: 'mono-text', inputClassName: 'order-input', placeholder: '0513-100' })}</td>
        <td>{renderUrlCell(product, draft, 'rakumart_url_5')}</td>
        <td>{formatDateTime(product.product_info_synced_at)}</td>
        <td>{formatDateTime(product.order_status_synced_at)}</td>
        <td>{formatDateTime(product.updated_at)}</td>
      </>
    )
  }

  function renderPickColumns(product: Product, draft: EditableProduct) {
    return (
      <>
        <td>{renderTextCell(product, draft, 'product_name', { className: 'product-name-text', inputClassName: 'product-name-input' })}</td>
        <td>{renderTextCell(product, draft, 'special_notes', { className: 'note-text', multiline: true, placeholder: '特記事項' })}</td>
        <td>{renderTextCell(product, draft, 'picking_advice', { className: 'note-text', multiline: true, placeholder: 'ピック時アドバイス' })}</td>
        <td>{renderTextCell(product, draft, 'floor', { inputClassName: 'floor-input' })}</td>
        <td>{renderTextCell(product, draft, 'rack_number', { inputClassName: 'rack-input' })}</td>
        <td>{renderTextCell(product, draft, 'rack_level', { inputClassName: 'rack-level-input' })}</td>
        <td>{renderTextCell(product, draft, 'sticker_color', { inputClassName: 'sticker-input' })}</td>
      </>
    )
  }

  function renderCustomColumns(product: Product, draft: EditableProduct) {
    return (
      <>
        <td>{renderTextCell(product, draft, 'product_name', { className: 'product-name-text', inputClassName: 'product-name-input' })}</td>
        <td>{renderTextCell(product, draft, 'floor', { inputClassName: 'floor-input' })}</td>
        <td>{renderTextCell(product, draft, 'rack_number', { inputClassName: 'rack-input' })}</td>
        <td>{renderTextCell(product, draft, 'rack_level', { inputClassName: 'rack-level-input' })}</td>
        <td>{renderTextCell(product, draft, 'sticker_color', { inputClassName: 'sticker-input' })}</td>
        <td>{renderTextCell(product, draft, 'special_notes', { className: 'note-text', multiline: true, placeholder: '特記事項' })}</td>
        <td>{renderTextCell(product, draft, 'picking_advice', { className: 'note-text', multiline: true, placeholder: 'ピック時アドバイス' })}</td>
        <td>{renderTextCell(product, draft, 'order_memo_1', { className: 'mono-text', inputClassName: 'order-input', placeholder: '0513-100' })}</td>
        <td>{renderUrlCell(product, draft, 'rakumart_url_1')}</td>
        <td>{formatDateTime(product.updated_at)}</td>
      </>
    )
  }

  const tableColSpan = tableView === 'all' ? 22 : tableView === 'pick' ? 9 : 12
  const tableClassName = `products-table products-table--${tableView}`

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card login-card--simple">
          <img src={`${import.meta.env.BASE_URL}login-logo.png`} alt="Shohin DB" className="login-logo" />

          <div className="form-stack login-form-stack">
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
        <div className="topbar-brand">
          <img
            src={`${import.meta.env.BASE_URL}login-logo.png`}
            alt="商品DB"
            className="topbar-logo"
          />
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
          placeholder="商品コード・商品名・特記事項・ピック時アドバイス・棚番号で検索"
        />

        <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
          <option value="">全フロア</option>
          {floors.map((floor) => (
            <option key={floor} value={floor}>
              {floor}
            </option>
          ))}
        </select>

        <button onClick={fetchProducts} disabled={loading || Boolean(savingCode)}>
          再読み込み
        </button>

        <button onClick={() => openCreateModal('single')}>新規追加</button>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="layout layout--full">
        <div className="table-card">
          <div className="table-header">
            <div>
              <strong>商品一覧</strong>
              <span>{filteredProducts.length}件</span>
            </div>

            <div className="view-switch" aria-label="表示用途切り替え">
              <ViewButton active={tableView === 'all'} onClick={() => setTableView('all')}>
                すべて
              </ViewButton>
              <ViewButton active={tableView === 'pick'} onClick={() => setTableView('pick')}>
                ピック用
              </ViewButton>
              <ViewButton active={tableView === 'custom'} onClick={() => setTableView('custom')}>
                カスタム
              </ViewButton>
            </div>
          </div>

          <div className="table-wrap">
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th>商品コード</th>

                  {tableView === 'all' && (
                    <>
                      <th>商品名</th>
                      <th>階数</th>
                      <th>特記事項</th>
                      <th>ピック時アドバイス</th>
                      <th>棚番号-位置</th>
                      <th>棚番号-段</th>
                      <th>シールカラー</th>
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
                    </>
                  )}

                  {tableView === 'pick' && (
                    <>
                      <th>商品名</th>
                      <th>特記事項</th>
                      <th>ピック時アドバイス</th>
                      <th>階数</th>
                      <th>棚番号-位置</th>
                      <th>棚番号-段</th>
                      <th>シールカラー</th>
                    </>
                  )}

                  {tableView === 'custom' && (
                    <>
                      <th>商品名</th>
                      <th>階数</th>
                      <th>棚番号-位置</th>
                      <th>棚番号-段</th>
                      <th>シールカラー</th>
                      <th>特記事項</th>
                      <th>ピック時アドバイス</th>
                      <th>発注1</th>
                      <th>ラクマート1</th>
                      <th>更新日</th>
                    </>
                  )}

                  <th>操作</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const draft = rowDrafts[product.product_code] ?? productToDraft(product)
                  const isEditing = editingCode === product.product_code
                  const dirty = isEditing && isDraftDirty(product, draft)

                  return (
                    <tr
                      key={product.product_code}
                      className={`${isEditing ? 'is-editing' : ''} ${dirty ? 'is-dirty' : ''}`}
                    >
                      <td className="code sticky-code-cell">
                        <button
                          type="button"
                          className="code-copy"
                          onClick={() => copyProductCode(product.product_code)}
                          title="商品コードをコピー"
                        >
                          {product.product_code}
                        </button>
                      </td>

                      {tableView === 'all' && renderAllColumns(product, draft)}
                      {tableView === 'pick' && renderPickColumns(product, draft)}
                      {tableView === 'custom' && renderCustomColumns(product, draft)}

                      <td>{renderActions(product, draft)}</td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={tableColSpan} className="empty">
                      商品がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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

                <div className="modal-grid">
                  <label>
                    階数
                    <input
                      value={createForm.floor}
                      onChange={(e) => updateCreateForm('floor', e.target.value)}
                      placeholder="3F"
                    />
                  </label>

                  <label>
                    棚番号-位置
                    <input
                      value={createForm.rack_number}
                      onChange={(e) => updateCreateForm('rack_number', e.target.value)}
                      placeholder="A-12"
                    />
                  </label>

                  <label>
                    棚番号-段
                    <input
                      value={createForm.rack_level}
                      onChange={(e) => updateCreateForm('rack_level', e.target.value)}
                      placeholder="3"
                    />
                  </label>

                  <label>
                    シールカラー
                    <input
                      value={createForm.sticker_color}
                      onChange={(e) => updateCreateForm('sticker_color', e.target.value)}
                      placeholder="赤"
                    />
                  </label>
                </div>

                <label>
                  特記事項
                  <textarea
                    value={createForm.special_notes}
                    onChange={(e) => updateCreateForm('special_notes', e.target.value)}
                    placeholder="保管・取扱いで注意すること"
                  />
                </label>

                <label>
                  ピック時アドバイス
                  <textarea
                    value={createForm.picking_advice}
                    onChange={(e) => updateCreateForm('picking_advice', e.target.value)}
                    placeholder="ピック時に見る補足"
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
                  <strong>1商品1行で入力</strong>
                  <p>
                    商品コード・商品名・階数・棚番号-位置・棚番号-段・シールカラー・特記事項・ピック時アドバイスの順で入力できます。
                    Excelから複数行コピーして、1行目の商品コード欄に貼り付けても自動展開されます。
                  </p>
                </div>

                <div className="bulk-row-toolbar">
                  <strong>商品入力行</strong>

                  <div className="bulk-row-actions">
                    <button className="secondary small" onClick={() => addBulkRows(5)}>
                      5行追加
                    </button>

                    <button className="secondary small" onClick={clearBulkRows}>
                      クリア
                    </button>
                  </div>
                </div>

                <div className="bulk-table-wrap">
                  <table className="bulk-input-table bulk-input-table--wide">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>商品コード</th>
                        <th>商品名</th>
                        <th>階数</th>
                        <th>棚番号-位置</th>
                        <th>棚番号-段</th>
                        <th>シールカラー</th>
                        <th>特記事項</th>
                        <th>ピック時アドバイス</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {bulkRows.map((row, index) => (
                        <tr key={row.id}>
                          <td className="bulk-row-number">{index + 1}</td>

                          <td>
                            <input
                              value={row.product_code}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'product_code', e.target.value)
                              }
                              onPaste={(e) => handleBulkPaste(e, index)}
                              placeholder="mus-04"
                            />
                          </td>

                          <td>
                            <input
                              value={row.product_name}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'product_name', e.target.value)
                              }
                              placeholder="ストリングクリーナー"
                            />
                          </td>

                          <td>
                            <input
                              value={row.floor}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'floor', e.target.value)
                              }
                              placeholder="3F"
                            />
                          </td>

                          <td>
                            <input
                              value={row.rack_number}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'rack_number', e.target.value)
                              }
                              placeholder="A-12"
                            />
                          </td>

                          <td>
                            <input
                              value={row.rack_level}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'rack_level', e.target.value)
                              }
                              placeholder="3"
                            />
                          </td>

                          <td>
                            <input
                              value={row.sticker_color}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'sticker_color', e.target.value)
                              }
                              placeholder="赤"
                            />
                          </td>

                          <td>
                            <input
                              value={row.special_notes}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'special_notes', e.target.value)
                              }
                              placeholder="特記事項"
                            />
                          </td>

                          <td>
                            <input
                              value={row.picking_advice}
                              onChange={(e) =>
                                updateBulkRow(row.id, 'picking_advice', e.target.value)
                              }
                              placeholder="ピック時アドバイス"
                            />
                          </td>

                          <td>
                            <button
                              className="secondary small"
                              onClick={() => removeBulkRow(row.id)}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bulk-preview">
                  <span>入力済み：{bulkSummary.filledCount}件</span>
                  <span>追加予定：{bulkInsertableCount}件</span>
                  <span>既存スキップ：{bulkExistingCount}件</span>
                  {bulkSummary.duplicateCodes.length > 0 && (
                    <span>入力内重複：{bulkSummary.duplicateCodes.length}件</span>
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
