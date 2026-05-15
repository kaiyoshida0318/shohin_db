import { type ChangeEvent, type ClipboardEvent, type DragEvent, useEffect, useMemo, useState } from 'react'
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

  order_url_1: string | null
  order_url_2: string | null
  order_url_3: string | null
  order_size: string | null
  order_color: string | null
  order_simple_instruction: string | null
  order_detail_instruction: string | null
  order_quantity_condition: string | null
  order_note: string | null

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

  order_url_1: string
  order_url_2: string
  order_url_3: string
  order_size: string
  order_color: string
  order_simple_instruction: string
  order_detail_instruction: string
  order_quantity_condition: string
  order_note: string

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

type TableView = 'all' | 'pick' | 'order' | 'purchase' | 'custom'

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
  order_url_1: string
  order_url_2: string
  order_url_3: string
  order_size: string
  order_color: string
  order_simple_instruction: string
  order_detail_instruction: string
  order_quantity_condition: string
  order_note: string
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
  order_url_1: string
  order_url_2: string
  order_url_3: string
  order_size: string
  order_color: string
  order_simple_instruction: string
  order_detail_instruction: string
  order_quantity_condition: string
  order_note: string
}

type BulkFieldKey = Exclude<keyof CleanBulkProductRow, 'product_code'>

type BulkFieldColumn = {
  key: BulkFieldKey
  label: string
  placeholder: string
}

const BULK_FIELD_COLUMNS: BulkFieldColumn[] = [
  { key: 'product_name', label: '商品名', placeholder: '商品名' },
  { key: 'floor', label: '階数', placeholder: '階数' },
  { key: 'rack_number', label: '棚番号-位置', placeholder: '棚番号-位置' },
  { key: 'rack_level', label: '棚番号-段', placeholder: '棚番号-段' },
  { key: 'sticker_color', label: 'シールカラー', placeholder: 'シールカラー' },
  { key: 'special_notes', label: '特記事項', placeholder: '特記事項' },
  { key: 'picking_advice', label: 'ピック時アドバイス', placeholder: 'ピック時アドバイス' },
  { key: 'order_url_1', label: '発注URL1', placeholder: '発注URL1' },
  { key: 'order_url_2', label: '発注URL2', placeholder: '発注URL2' },
  { key: 'order_url_3', label: '発注URL3', placeholder: '発注URL3' },
  { key: 'order_size', label: 'サイズ', placeholder: 'サイズ' },
  { key: 'order_color', label: 'カラー', placeholder: 'カラー' },
  { key: 'order_simple_instruction', label: '■簡潔指示', placeholder: '■簡潔指示' },
  { key: 'order_detail_instruction', label: '▲具体指示', placeholder: '▲具体指示' },
  { key: 'order_quantity_condition', label: '数量条件指定', placeholder: '数量条件指定' },
  { key: 'order_note', label: '補足情報', placeholder: '補足情報' },
]

const DEFAULT_BULK_FIELD_KEYS = BULK_FIELD_COLUMNS.map(
  (column) => column.key,
)


type CsvImportResult = {
  rows: CleanBulkProductRow[]
  fields: BulkFieldKey[]
}

type CsvColumnMapping = {
  filename: string
  headers: string[]
  dataRows: string[][]
  productCodeIndex: number | null
  fieldIndexes: Partial<Record<BulkFieldKey, number>>
}

type CsvMappingKey = BulkFieldKey | 'product_code'

const CSV_HEADER_ALIASES: Record<BulkFieldKey | 'product_code', string[]> = {
  product_code: [
    '商品コード',
    '商品番号',
    '商品管理番号',
    'SKUコード',
    'product_code',
    'productCode',
    'code',
    'sku',
  ],
  product_name: [
    '商品名',
    'product_name',
    'productName',
    'shipping_name',
    'shippingName',
    'name',
  ],
  floor: ['階数', 'フロア', 'floor'],
  rack_number: [
    '棚番号-位置',
    '棚番号位置',
    '棚番号',
    'ラック番号',
    'rack_number',
    'rackNumber',
    'rack',
    'location',
  ],
  rack_level: [
    '棚番号-段',
    '棚番号段',
    '段',
    'ラック段',
    'rack_level',
    'rackLevel',
    'level',
  ],
  sticker_color: [
    'シールカラー',
    'シール色',
    'sticker_color',
    'stickerColor',
    'color',
  ],
  special_notes: ['特記事項', '注意事項', 'special_notes', 'specialNotes', 'notes', 'note'],
  picking_advice: [
    'ピック時アドバイス',
    'ピックアドバイス',
    'picking_advice',
    'pickingAdvice',
    'advice',
  ],
  order_url_1: ['発注URL1', '発注URL 1', 'order_url_1', 'orderUrl1', 'purchase_url_1', 'purchaseUrl1'],
  order_url_2: ['発注URL2', '発注URL 2', 'order_url_2', 'orderUrl2', 'purchase_url_2', 'purchaseUrl2'],
  order_url_3: ['発注URL3', '発注URL 3', 'order_url_3', 'orderUrl3', 'purchase_url_3', 'purchaseUrl3'],
  order_size: ['サイズ', 'order_size', 'orderSize', 'purchase_size', 'purchaseSize', 'size'],
  order_color: ['カラー', '色', 'order_color', 'orderColor', 'purchase_color', 'purchaseColor'],
  order_simple_instruction: [
    '■簡潔指示',
    '簡潔指示',
    'order_simple_instruction',
    'orderSimpleInstruction',
    'simple_instruction',
    'simpleInstruction',
  ],
  order_detail_instruction: [
    '▲具体指示',
    '具体指示',
    'order_detail_instruction',
    'orderDetailInstruction',
    'detail_instruction',
    'detailInstruction',
  ],
  order_quantity_condition: [
    '数量条件指定',
    '数量条件',
    'order_quantity_condition',
    'orderQuantityCondition',
    'quantity_condition',
    'quantityCondition',
  ],
  order_note: ['補足情報', '補足', 'order_note', 'orderNote', 'purchase_note', 'purchaseNote'],
}

type BulkSummary = {
  filledCount: number
  uniqueRows: CleanBulkProductRow[]
  insertRows: CleanBulkProductRow[]
  updateRows: CleanBulkProductRow[]
  existingCount: number
  duplicateCodes: string[]
}

const INITIAL_BULK_ROW_COUNT = 10

function createEmptyCleanBulkProductRow(productCode = ''): CleanBulkProductRow {
  return {
    product_code: productCode,
    product_name: '',
    floor: '',
    special_notes: '',
    picking_advice: '',
    rack_number: '',
    rack_level: '',
    sticker_color: '',
    order_url_1: '',
    order_url_2: '',
    order_url_3: '',
    order_size: '',
    order_color: '',
    order_simple_instruction: '',
    order_detail_instruction: '',
    order_quantity_condition: '',
    order_note: '',
  }
}

function getBulkFieldLabel(key: BulkFieldKey) {
  return BULK_FIELD_COLUMNS.find((column) => column.key === key)?.label ?? key
}

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
    order_url_1: '',
    order_url_2: '',
    order_url_3: '',
    order_size: '',
    order_color: '',
    order_simple_instruction: '',
    order_detail_instruction: '',
    order_quantity_condition: '',
    order_note: '',
  }
}

function createBulkRows(count = INITIAL_BULK_ROW_COUNT): BulkProductRow[] {
  return Array.from({ length: count }, () => createBulkRow())
}

function splitBulkLine(line: string) {
  const cells = line.includes('\t') ? line.split('\t') : line.split(',')
  return cells.map((cell) => cell.trim())
}

function normalizeCsvHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_＿\-－ー]/g, '')
}

function getCsvColumnIndex(headers: string[], key: BulkFieldKey | 'product_code') {
  const normalizedAliases = CSV_HEADER_ALIASES[key].map(normalizeCsvHeader)

  return headers.findIndex((header) =>
    normalizedAliases.includes(normalizeCsvHeader(header)),
  )
}

function parseDelimitedRows(text: string, delimiter: ',' | '\t' = ',') {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      row.push(cell.trim())
      if (row.some((value) => value)) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell.trim())
  if (row.some((value) => value)) {
    rows.push(row)
  }

  return rows
}

function parseCsvRows(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const delimiter =
    firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ','

  return parseDelimitedRows(text, delimiter)
}


function getInitialCsvFieldIndexes(headers: string[]) {
  return BULK_FIELD_COLUMNS.reduce<Partial<Record<BulkFieldKey, number>>>(
    (indexes, column) => {
      const index = getCsvColumnIndex(headers, column.key)

      if (index >= 0) {
        indexes[column.key] = index
      }

      return indexes
    },
    {},
  )
}

function createCsvColumnMapping(text: string, filename: string): CsvColumnMapping {
  const rows = parseCsvRows(text)

  if (rows.length < 2) {
    throw new Error('CSVに取り込めるデータ行がありません。')
  }

  const headers = rows[0]
  const productCodeIndex = getCsvColumnIndex(headers, 'product_code')

  return {
    filename,
    headers,
    dataRows: rows.slice(1),
    productCodeIndex: productCodeIndex >= 0 ? productCodeIndex : null,
    fieldIndexes: getInitialCsvFieldIndexes(headers),
  }
}

function getMappedCsvFields(fieldIndexes: Partial<Record<BulkFieldKey, number>>) {
  return BULK_FIELD_COLUMNS.map((column) => ({
    key: column.key,
    index: fieldIndexes[column.key],
  })).filter(
    (column): column is { key: BulkFieldKey; index: number } =>
      typeof column.index === 'number' && column.index >= 0,
  )
}

function getCsvColumnAssignment(
  mapping: CsvColumnMapping,
  columnIndex: number,
): CsvMappingKey | '' {
  if (mapping.productCodeIndex === columnIndex) {
    return 'product_code'
  }

  const assignedField = BULK_FIELD_COLUMNS.find(
    (column) => mapping.fieldIndexes[column.key] === columnIndex,
  )

  return assignedField?.key ?? ''
}

function csvColumnHasData(dataRows: string[][], columnIndex: number) {
  return dataRows.some((row) => (row[columnIndex] ?? '').trim())
}

function getUnassignedCsvColumnIndexes(mapping: CsvColumnMapping) {
  return mapping.headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => {
      const hasHeaderOrData = Boolean(header.trim()) || csvColumnHasData(mapping.dataRows, index)
      return hasHeaderOrData && !getCsvColumnAssignment(mapping, index)
    })
    .map(({ index }) => index)
}

function csvMappingNeedsManualCheck(mapping: CsvColumnMapping) {
  const mappedFields = getMappedCsvFields(mapping.fieldIndexes)

  return (
    mapping.productCodeIndex === null ||
    mappedFields.length === 0 ||
    getUnassignedCsvColumnIndexes(mapping).length > 0
  )
}

function getCsvMappingMessage(mapping: CsvColumnMapping) {
  if (mapping.productCodeIndex === null || getMappedCsvFields(mapping.fieldIndexes).length === 0) {
    return `${mapping.filename} の列名を自動識別できませんでした。下の列割り当てで指定してください。`
  }

  const unassignedCount = getUnassignedCsvColumnIndexes(mapping).length

  return `${mapping.filename} に未識別列が ${unassignedCount} 列あります。全CSV列を確認して、必要な列だけ割り当ててください。`
}

function buildCsvImportResult(
  dataRows: string[][],
  productCodeIndex: number | null,
  fieldIndexes: Partial<Record<BulkFieldKey, number>>,
): CsvImportResult {
  if (productCodeIndex === null || productCodeIndex < 0) {
    throw new Error('商品コードに使うCSV列を選択してください。')
  }

  const mappedFields = getMappedCsvFields(fieldIndexes)

  if (mappedFields.length === 0) {
    throw new Error('追加/更新する列を1つ以上選択してください。')
  }

  const importedRows = dataRows
    .map((cells) => {
      const row = createEmptyCleanBulkProductRow(
        cells[productCodeIndex]?.trim() ?? '',
      )

      mappedFields.forEach(({ key, index }) => {
        row[key] = cells[index]?.trim() ?? ''
      })

      return row
    })
    .filter((row) => row.product_code)

  if (importedRows.length === 0) {
    throw new Error('商品コードが入っている行がありません。')
  }

  return {
    rows: importedRows,
    fields: mappedFields.map((field) => field.key),
  }
}


function cleanRowToBulkRow(row: CleanBulkProductRow): BulkProductRow {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    ...row,
  }
}

function decodeCsvBuffer(buffer: ArrayBuffer) {
  const utf8Text = new TextDecoder('utf-8').decode(buffer)

  try {
    const shiftJisText = new TextDecoder('shift_jis').decode(buffer)
    const utf8ReplacementCount = (utf8Text.match(/�/g) ?? []).length
    const shiftJisReplacementCount = (shiftJisText.match(/�/g) ?? []).length

    if (
      utf8ReplacementCount > shiftJisReplacementCount ||
      (!utf8Text.includes('商品コード') && shiftJisText.includes('商品コード'))
    ) {
      return shiftJisText
    }
  } catch {
    // ブラウザがshift_jisのTextDecoderに未対応の場合はUTF-8として扱う
  }

  return utf8Text
}

function parseClipboardRows(
  text: string,
  selectedFields: BulkFieldKey[],
): CleanBulkProductRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines
    .map((line, index) => {
      const cells = splitBulkLine(line)
      const firstCell = normalizeCsvHeader(cells[0] ?? '')

      if (
        index === 0 &&
        CSV_HEADER_ALIASES.product_code
          .map(normalizeCsvHeader)
          .includes(firstCell)
      ) {
        return null
      }

      const row = createEmptyCleanBulkProductRow(cells[0]?.trim() ?? '')

      selectedFields.forEach((key, fieldIndex) => {
        row[key] = cells[fieldIndex + 1]?.trim() ?? ''
      })

      return row
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
      order_url_1: row.order_url_1.trim(),
      order_url_2: row.order_url_2.trim(),
      order_url_3: row.order_url_3.trim(),
      order_size: row.order_size.trim(),
      order_color: row.order_color.trim(),
      order_simple_instruction: row.order_simple_instruction.trim(),
      order_detail_instruction: row.order_detail_instruction.trim(),
      order_quantity_condition: row.order_quantity_condition.trim(),
      order_note: row.order_note.trim(),
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

  const updateRows = uniqueRows.filter((row) =>
    existingProductCodes.has(row.product_code),
  )

  const insertRows = uniqueRows.filter(
    (row) => !existingProductCodes.has(row.product_code),
  )

  return {
    filledCount: filledRows.length,
    uniqueRows,
    insertRows,
    updateRows,
    existingCount: updateRows.length,
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
    order_url_1: product.order_url_1 ?? '',
    order_url_2: product.order_url_2 ?? '',
    order_url_3: product.order_url_3 ?? '',
    order_size: product.order_size ?? '',
    order_color: product.order_color ?? '',
    order_simple_instruction: product.order_simple_instruction ?? '',
    order_detail_instruction: product.order_detail_instruction ?? '',
    order_quantity_condition: product.order_quantity_condition ?? '',
    order_note: product.order_note ?? '',
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
    order_url_1: draft.order_url_1.trim() || null,
    order_url_2: draft.order_url_2.trim() || null,
    order_url_3: draft.order_url_3.trim() || null,
    order_size: draft.order_size.trim() || null,
    order_color: draft.order_color.trim() || null,
    order_simple_instruction: draft.order_simple_instruction.trim() || null,
    order_detail_instruction: draft.order_detail_instruction.trim() || null,
    order_quantity_condition: draft.order_quantity_condition.trim() || null,
    order_note: draft.order_note.trim() || null,
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
  const [tableView, setTableView] = useState<TableView>('all')

  const [loading, setLoading] = useState(false)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkProductRow[]>(() =>
    createBulkRows(),
  )
  const [bulkShouldUpdateExisting, setBulkShouldUpdateExisting] = useState(false)
  const [selectedBulkFields, setSelectedBulkFields] = useState<BulkFieldKey[]>(
    DEFAULT_BULK_FIELD_KEYS,
  )
  const [csvColumnMapping, setCsvColumnMapping] = useState<CsvColumnMapping | null>(null)
  const [isCsvDragOver, setIsCsvDragOver] = useState(false)
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
    if (!user || !message) {
      return
    }

    const timer = window.setTimeout(() => {
      setMessage('')
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [message, user])

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

  const bulkSummary = useMemo(() => {
    return buildBulkSummary(bulkRows, existingProductCodes)
  }, [bulkRows, existingProductCodes])

  const selectedBulkColumns = useMemo(() => {
    return BULK_FIELD_COLUMNS.filter((column) =>
      selectedBulkFields.includes(column.key),
    )
  }, [selectedBulkFields])


  const bulkInsertableCount = bulkSummary.insertRows.length
  const bulkUpdateableCount = bulkSummary.updateRows.length
  const bulkExistingCount = bulkSummary.existingCount
  const bulkActionableCount = bulkShouldUpdateExisting
    ? bulkSummary.uniqueRows.length
    : bulkInsertableCount

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
          draft.order_url_1,
          draft.order_url_2,
          draft.order_url_3,
          draft.order_size,
          draft.order_color,
          draft.order_simple_instruction,
          draft.order_detail_instruction,
          draft.order_quantity_condition,
          draft.order_note,
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

      return matchesKeyword
    })
  }, [products, rowDrafts, editingCode, keyword])

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

  function openCreateModal() {
    setBulkRows(createBulkRows())
    setBulkShouldUpdateExisting(false)
    setSelectedBulkFields(DEFAULT_BULK_FIELD_KEYS)
    setCsvColumnMapping(null)
    setIsCsvDragOver(false)
    setModalMessage('')
    setIsCreateModalOpen(true)
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false)
    setBulkRows(createBulkRows())
    setBulkShouldUpdateExisting(false)
    setSelectedBulkFields(DEFAULT_BULK_FIELD_KEYS)
    setCsvColumnMapping(null)
    setIsCsvDragOver(false)
    setModalMessage('')
  }

  function toggleBulkField(fieldKey: BulkFieldKey) {
    setSelectedBulkFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.length > 1 ? prev.filter((key) => key !== fieldKey) : prev
      }

      return BULK_FIELD_COLUMNS.filter(
        (column) => column.key === fieldKey || prev.includes(column.key),
      ).map((column) => column.key)
    })
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
    setCsvColumnMapping(null)
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

    const pastedRows = parseClipboardRows(text, selectedBulkFields)

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
        }

        selectedBulkFields.forEach((key) => {
          next[targetIndex][key] = pastedRow[key]
        })
      })

      return next
    })
  }


  function applyCsvImportResult(result: CsvImportResult, filename: string) {
    const blankRows = createBulkRows(3)

    setSelectedBulkFields(result.fields)
    setBulkRows([...result.rows.map(cleanRowToBulkRow), ...blankRows])
    setCsvColumnMapping(null)
    setModalMessage(
      `${filename} を読み込みました。対象列：${result.fields
        .map(getBulkFieldLabel)
        .join('・')}`,
    )
  }

  async function importCsvFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const text = decodeCsvBuffer(buffer)
      const mapping = createCsvColumnMapping(text, file.name)
      if (csvMappingNeedsManualCheck(mapping)) {
        setCsvColumnMapping(mapping)
        setModalMessage(getCsvMappingMessage(mapping))
        return
      }

      applyCsvImportResult(
        buildCsvImportResult(
          mapping.dataRows,
          mapping.productCodeIndex,
          mapping.fieldIndexes,
        ),
        file.name,
      )
    } catch (error) {
      setCsvColumnMapping(null)
      setModalMessage(
        error instanceof Error
          ? `CSV読み込み失敗: ${error.message}`
          : 'CSV読み込みに失敗しました。',
      )
    }
  }

  async function handleBulkCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    await importCsvFile(file)
  }

  function handleCsvDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsCsvDragOver(true)
  }

  function handleCsvDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null

    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsCsvDragOver(false)
    }
  }

  async function handleCsvDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsCsvDragOver(false)

    const droppedFiles = Array.from(event.dataTransfer.files)
    const csvFile =
      droppedFiles.find(
        (file) =>
          file.name.toLowerCase().endsWith('.csv') ||
          file.type.includes('csv') ||
          file.type === 'text/plain',
      ) ?? droppedFiles[0]

    if (!csvFile) {
      setModalMessage('CSVファイルをドロップしてください。')
      return
    }

    await importCsvFile(csvFile)
  }

  function updateCsvSourceColumnMapping(columnIndex: number, value: string) {
    const key = value as CsvMappingKey | ''

    setCsvColumnMapping((prev) => {
      if (!prev) {
        return prev
      }

      const nextFieldIndexes = { ...prev.fieldIndexes }

      BULK_FIELD_COLUMNS.forEach((column) => {
        if (nextFieldIndexes[column.key] === columnIndex || column.key === key) {
          delete nextFieldIndexes[column.key]
        }
      })

      const next: CsvColumnMapping = {
        ...prev,
        productCodeIndex:
          prev.productCodeIndex === columnIndex || key === 'product_code'
            ? null
            : prev.productCodeIndex,
        fieldIndexes: nextFieldIndexes,
      }

      if (key === 'product_code') {
        next.productCodeIndex = columnIndex
      } else if (key) {
        next.fieldIndexes[key] = columnIndex
      }

      return next
    })
  }

  function applyManualCsvMapping() {
    if (!csvColumnMapping) {
      return
    }

    try {
      const result = buildCsvImportResult(
        csvColumnMapping.dataRows,
        csvColumnMapping.productCodeIndex,
        csvColumnMapping.fieldIndexes,
      )

      applyCsvImportResult(result, csvColumnMapping.filename)
    } catch (error) {
      setModalMessage(
        error instanceof Error
          ? `CSV列割り当て失敗: ${error.message}`
          : 'CSV列割り当てに失敗しました。',
      )
    }
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

  async function createBulkProducts() {
    const targetRows = bulkShouldUpdateExisting
      ? bulkSummary.uniqueRows
      : bulkSummary.insertRows

    if (bulkSummary.filledCount === 0) {
      setModalMessage('追加/更新できる商品がありません。')
      return
    }

    if (targetRows.length === 0) {
      setModalMessage(
        bulkShouldUpdateExisting
          ? '入力内重複のため追加/更新対象がありません。'
          : 'すべて既存商品コード、または入力内重複のため追加対象がありません。既存も更新する場合はチェックを入れてください。',
      )
      return
    }

    setLoading(true)
    setModalMessage('')

    const now = new Date().toISOString()
    const payload = targetRows.map((row) => {
      const productPayload: Record<string, string | null> = {
        product_code: row.product_code,
        updated_at: now,
      }

      selectedBulkFields.forEach((key) => {
        productPayload[key] = row[key] || null
      })

      return productPayload
    })

    const { error } = bulkShouldUpdateExisting
      ? await supabase
          .from('products')
          .upsert(payload, { onConflict: 'product_code' })
      : await supabase.from('products').insert(payload)

    if (error) {
      setModalMessage(`一括追加/更新失敗: ${error.message}`)
    } else {
      closeCreateModal()
      setMessage(
        bulkShouldUpdateExisting
          ? `${bulkInsertableCount}件追加、${bulkUpdateableCount}件更新しました。`
          : `${bulkInsertableCount}件追加しました。既存商品のスキップ：${bulkExistingCount}件`,
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

  function renderUrlTextCell(
    product: Product,
    draft: EditableProduct,
    key: EditableProductKey,
  ) {
    const isEditing = editingCode === product.product_code

    if (isEditing) {
      return (
        <UrlEditCell
          value={draft[key]}
          onChange={(value) => updateDraft(product.product_code, key, value)}
        />
      )
    }

    const url = String(product[key] ?? '').trim()

    if (!url) {
      return <DisplayText value={null} className="mono-text" />
    }

    return (
      <a className="order-link mono-text" href={url} target="_blank" rel="noreferrer">
        開く
      </a>
    )
  }

  function renderOrderMemoCell(
    product: Product,
    draft: EditableProduct,
    orderKey: EditableProductKey,
    urlKey: EditableProductKey,
  ) {
    const isEditing = editingCode === product.product_code

    if (isEditing) {
      return (
        <div className="order-edit-stack">
          <input
            className="table-input order-input"
            value={draft[orderKey]}
            onChange={(event) =>
              updateDraft(product.product_code, orderKey, event.target.value)
            }
            placeholder="0513-100"
          />

          <div className="order-rm-edit-row">
            <span>RM</span>
            <UrlEditCell
              value={draft[urlKey]}
              onChange={(value) => updateDraft(product.product_code, urlKey, value)}
            />
          </div>
        </div>
      )
    }

    const orderValue = String(product[orderKey] ?? '').trim()
    const url = String(product[urlKey] ?? '').trim()

    if (!orderValue) {
      return <DisplayText value={null} className="mono-text" />
    }

    if (!url) {
      return <DisplayText value={orderValue} className="mono-text" />
    }

    return (
      <a className="order-link mono-text" href={url} target="_blank" rel="noreferrer" title="RMを開く">
        {orderValue}
      </a>
    )
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
        <td>{renderOrderMemoCell(product, draft, 'order_memo_1', 'rakumart_url_1')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_2', 'rakumart_url_2')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_3', 'rakumart_url_3')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_4', 'rakumart_url_4')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_5', 'rakumart_url_5')}</td>
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

  function renderOrderColumns(product: Product, draft: EditableProduct) {
    return (
      <>
        <td>{renderTextCell(product, draft, 'product_name', { className: 'product-name-text', inputClassName: 'product-name-input' })}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_1', 'rakumart_url_1')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_2', 'rakumart_url_2')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_3', 'rakumart_url_3')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_4', 'rakumart_url_4')}</td>
        <td>{renderOrderMemoCell(product, draft, 'order_memo_5', 'rakumart_url_5')}</td>
      </>
    )
  }

  function renderPurchaseColumns(product: Product, draft: EditableProduct) {
    return (
      <>
        <td>{renderTextCell(product, draft, 'product_name', { className: 'product-name-text', inputClassName: 'product-name-input' })}</td>
        <td>{renderUrlTextCell(product, draft, 'order_url_1')}</td>
        <td>{renderUrlTextCell(product, draft, 'order_url_2')}</td>
        <td>{renderUrlTextCell(product, draft, 'order_url_3')}</td>
        <td>{renderTextCell(product, draft, 'order_size', { inputClassName: 'small-text-input' })}</td>
        <td>{renderTextCell(product, draft, 'order_color', { inputClassName: 'small-text-input' })}</td>
        <td>{renderTextCell(product, draft, 'order_simple_instruction', { className: 'note-text', multiline: true, placeholder: '■簡潔指示' })}</td>
        <td>{renderTextCell(product, draft, 'order_detail_instruction', { className: 'note-text', multiline: true, placeholder: '▲具体指示' })}</td>
        <td>{renderTextCell(product, draft, 'order_quantity_condition', { className: 'note-text', multiline: true, placeholder: '数量条件指定' })}</td>
        <td>{renderTextCell(product, draft, 'order_note', { className: 'note-text', multiline: true, placeholder: '補足情報' })}</td>
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
        <td>{renderOrderMemoCell(product, draft, 'order_memo_1', 'rakumart_url_1')}</td>
        <td>{formatDateTime(product.updated_at)}</td>
      </>
    )
  }

  const tableColSpan = tableView === 'all' ? 17 : tableView === 'pick' ? 9 : tableView === 'order' ? 8 : tableView === 'purchase' ? 12 : 11
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

        <button onClick={fetchProducts} disabled={loading || Boolean(savingCode)}>
          再読み込み
        </button>

        <button onClick={openCreateModal}>商品追加/更新</button>
      </section>

      {message && (
        <div className="toast-message" role="status" aria-live="polite">
          {message}
        </div>
      )}

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
              <ViewButton active={tableView === 'order'} onClick={() => setTableView('order')}>
                オーダー状況
              </ViewButton>
              <ViewButton active={tableView === 'purchase'} onClick={() => setTableView('purchase')}>
                オーダー用
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
                      <th>オーダー1</th>
                      <th>オーダー2</th>
                      <th>オーダー3</th>
                      <th>オーダー4</th>
                      <th>オーダー5</th>
                      <th>商品同期</th>
                      <th>オーダー同期</th>
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

                  {tableView === 'order' && (
                    <>
                      <th>商品名</th>
                      <th>オーダー1</th>
                      <th>オーダー2</th>
                      <th>オーダー3</th>
                      <th>オーダー4</th>
                      <th>オーダー5</th>
                    </>
                  )}

                  {tableView === 'purchase' && (
                    <>
                      <th>商品名</th>
                      <th>発注URL1</th>
                      <th>発注URL2</th>
                      <th>発注URL3</th>
                      <th>サイズ</th>
                      <th>カラー</th>
                      <th>■簡潔指示</th>
                      <th>▲具体指示</th>
                      <th>数量条件指定</th>
                      <th>補足情報</th>
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
                      <th>オーダー1</th>
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
                      {tableView === 'order' && renderOrderColumns(product, draft)}
                      {tableView === 'purchase' && renderPurchaseColumns(product, draft)}
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
            aria-label="商品追加/更新"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Product Add / Update</p>
                <h2>商品追加/更新</h2>
              </div>

              <button className="secondary small" onClick={closeCreateModal}>
                閉じる
              </button>
            </div>

            <div className="modal-body">
              <div className="bulk-field-selector">
                <div className="bulk-field-selector-head">
                  <strong>追加/更新の対象列</strong>
                  <span>商品コードは固定です。外した列は入力欄から消えて、既存データも上書きしません。</span>
                </div>

                <div className="bulk-field-buttons">
                  {BULK_FIELD_COLUMNS.map((column) => {
                    const selected = selectedBulkFields.includes(column.key)
                    const locked = selected && selectedBulkFields.length === 1

                    return (
                      <button
                        key={column.key}
                        type="button"
                        className={
                          selected
                            ? 'bulk-field-button active'
                            : 'bulk-field-button'
                        }
                        onClick={() => toggleBulkField(column.key)}
                        disabled={locked}
                        title={locked ? '対象列は最低1列必要です' : undefined}
                      >
                        {selected ? '✓ ' : '+ '}
                        {column.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div
                className={isCsvDragOver ? 'bulk-csv-import is-drag-over' : 'bulk-csv-import'}
                onDragOver={handleCsvDragOver}
                onDragLeave={handleCsvDragLeave}
                onDrop={handleCsvDrop}
              >
                <div>
                  <strong>CSV読み込み</strong>
                  <span>CSVを選択、またはここにドロップできます。列名が合わない場合は手動で割り当てできます。</span>
                </div>

                <label className="csv-upload-button">
                  CSVを選択
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleBulkCsvImport}
                  />
                </label>
              </div>

              {csvColumnMapping && (
                <div className="csv-mapping-panel">
                  <div className="csv-mapping-head">
                    <div>
                      <strong>CSV列の手動割り当て</strong>
                      <span>{csvColumnMapping.filename}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => setCsvColumnMapping(null)}
                    >
                      割り当てを閉じる
                    </button>
                  </div>

                  <div className="csv-mapping-help">
                    CSVの全列を表示しています。必要な列は取り込み先を選び、不要な列は「取り込まない」のままでOKです。
                  </div>

                  <div className="csv-mapping-grid csv-mapping-grid--source">
                    {csvColumnMapping.headers.map((header, index) => {
                      const assignedKey = getCsvColumnAssignment(csvColumnMapping, index)
                      const isUnassigned = !assignedKey && (header.trim() || csvColumnHasData(csvColumnMapping.dataRows, index))

                      return (
                        <label
                          key={`${header}-${index}`}
                          className={isUnassigned ? 'is-unassigned' : undefined}
                        >
                          <span>
                            {index + 1}列目：{header || '(列名なし)'}
                            {isUnassigned ? <small>未識別</small> : null}
                          </span>
                          <select
                            value={assignedKey}
                            onChange={(event) =>
                              updateCsvSourceColumnMapping(index, event.target.value)
                            }
                          >
                            <option value="">取り込まない</option>
                            <option value="product_code">商品コード</option>
                            {BULK_FIELD_COLUMNS.map((column) => (
                              <option key={column.key} value={column.key}>
                                {column.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )
                    })}
                  </div>

                  <div className="csv-mapping-actions">
                    <button type="button" onClick={applyManualCsvMapping}>
                      この割り当てでCSVを反映
                    </button>
                  </div>
                </div>
              )}

              <label className="bulk-update-option">
                <input
                  type="checkbox"
                  checked={bulkShouldUpdateExisting}
                  onChange={(event) =>
                    setBulkShouldUpdateExisting(event.target.checked)
                  }
                />
                <span>既存の商品コードも更新する</span>
                <small>ONにすると、既存商品の対象列だけを入力内容で上書きします。対象外の列は触りません。</small>
              </label>

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
                      {selectedBulkColumns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
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
                            placeholder="商品コード"
                          />
                        </td>

                        {selectedBulkColumns.map((column) => (
                          <td key={column.key}>
                            <input
                              value={row[column.key]}
                              onChange={(e) =>
                                updateBulkRow(row.id, column.key, e.target.value)
                              }
                              placeholder={column.placeholder}
                            />
                          </td>
                        ))}

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
                <span>更新予定：{bulkShouldUpdateExisting ? bulkUpdateableCount : 0}件</span>
                <span>既存スキップ：{bulkShouldUpdateExisting ? 0 : bulkExistingCount}件</span>
                {bulkSummary.duplicateCodes.length > 0 && (
                  <span>入力内重複：{bulkSummary.duplicateCodes.length}件</span>
                )}
              </div>

              {modalMessage && <p className="modal-message">{modalMessage}</p>}

              <div className="modal-actions">
                <button
                  onClick={createBulkProducts}
                  disabled={loading || bulkActionableCount === 0}
                >
                  {loading
                    ? '一括追加/更新中...'
                    : bulkShouldUpdateExisting
                      ? `${bulkInsertableCount}件追加 / ${bulkUpdateableCount}件更新`
                      : `${bulkInsertableCount}件を追加`}
                </button>

                <button className="secondary" onClick={closeCreateModal}>
                  キャンセル
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
