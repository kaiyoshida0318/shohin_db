import { type ChangeEvent, type ClipboardEvent, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const PRODUCT_IMAGE_BUCKET = 'product-images'
const PRODUCT_IMAGE_EXTENSION = '.webp'
const PRODUCT_IMAGE_WEBP_QUALITY = 0.92
const IMAGE_UPLOAD_CONCURRENCY = 5
const PRODUCT_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
const PRODUCT_FETCH_BATCH_SIZE = 1000
const PRODUCT_PAGE_SIZE = 200
const COLUMN_WIDTH_STORAGE_KEY = 'shohin-db-column-widths-v1'
const MIN_COLUMN_WIDTH = 64
const MAX_COLUMN_WIDTH = 720
const NE_SYNC_WORKER_URL = 'https://ne-sync-worker.kaiyoshida0318.workers.dev'
const NE_SYNC_FIELDS_STORAGE_KEY = 'shohin-db-ne-sync-fields-v1'
const NE_SYNC_MONTHS_STORAGE_KEY = 'shohin-db-ne-sync-months-v1'
const NE_SYNC_MONTH_MIN_YEAR = 2025
const AUTH_API_BASE_URL = String(import.meta.env.VITE_AUTH_API_BASE_URL ?? '').replace(/\/+$/, '')
const DEFAULT_AUTH_QUESTION = '秘密の質問'



type Product = {
  product_code: string
  product_name: string | null
  floor: string | null

  free_stock: number | null
  reorder_point: number | null
  stock_constant: number | null
  monthly_sales: unknown | null
  monthly_by_year?: unknown | null
  monthlyByYear?: unknown | null
  orderboard_classification: string | null

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

type ProductImagePreview = {
  productCode: string
  productName: string | null
  url: string
}

type ProductImageDraft = {
  file: File
  previewUrl: string
  sourceName: string
}

type NeUsageResult = {
  ok: boolean
  month?: string
  callCount?: number
  estimatedGb?: number
  remainingCalls?: number
  callLimit?: number
  byEndpoint?: Array<{ endpoint: string; calls: number; estimatedBytes: number; success: number; errors: number }>
  error?: string
}

type NeOperationalSyncResult = {
  ok: boolean
  dryRun?: boolean
  selectedFields?: string[]
  stockFetched?: number
  goodsFetched?: number
  merged?: number
  matched?: number
  unmatched?: number
  updated?: number
  message?: string
  error?: string
}

type NeMonthlySalesSyncResult = {
  ok: boolean
  dryRun?: boolean
  months?: string[]
  rowFetched?: number
  activeRows?: number
  aggregatedProducts?: number
  matched?: number
  unmatched?: number
  updated?: number
  message?: string
  error?: string
}


type SecretQuestionResponse = {
  ok?: boolean
  question?: string
  displayName?: string
  error?: string
}

type SecretLoginResponse = {
  ok?: boolean
  email?: string
  sub?: string
  user?: {
    id?: string
    email?: string
  }
  session?: {
    access_token?: string
    refresh_token?: string
  }
  error?: string
}

type NeOperationalFieldKey = 'free_stock' | 'reorder_point' | 'stock_constant'

type NeSyncFieldState = {
  freeStock: boolean
  reorderPoint: boolean
  stockConstant: boolean
  monthlySales: boolean
}

const DEFAULT_NE_SYNC_FIELDS: NeSyncFieldState = {
  freeStock: true,
  reorderPoint: true,
  stockConstant: true,
  monthlySales: false,
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

type TableView = 'all' | 'pick' | 'order' | 'purchase' | 'ne' | 'custom'

type ColumnSpec = {
  key: string
  label: string
  width: number
  className?: string
}

const SORTABLE_COLUMN_KEYS = [
  'product_code',
  'product_name',
  'free_stock',
  'reorder_point',
  'stock_constant',
  'orderboard_classification',
  'floor',
  'rack_number',
  'rack_level',
  'sticker_color',
  'order_memo_1',
  'order_memo_2',
  'order_memo_3',
  'order_memo_4',
  'order_memo_5',
] as const

type SortableColumnKey = (typeof SORTABLE_COLUMN_KEYS)[number]
type SortDirection = 'asc' | 'desc'
type SortConfig = { key: SortableColumnKey; direction: SortDirection } | null

const SORTABLE_COLUMN_SET = new Set<string>(SORTABLE_COLUMN_KEYS)

type ColumnWidthMap = Record<string, number>

type ColumnResizeMouseEvent = {
  clientX: number
  preventDefault: () => void
  stopPropagation: () => void
}


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

const EDIT_FIELD_PLACEHOLDERS: Record<EditableProductKey, string> = {
  product_name: '商品名',
  floor: '階数',
  special_notes: '特記事項',
  picking_advice: 'ピック時アドバイス',
  rack_number: '棚番号-位置',
  rack_level: '棚番号-段',
  sticker_color: 'シールカラー',
  order_url_1: '発注URL1',
  order_url_2: '発注URL2',
  order_url_3: '発注URL3',
  order_size: 'サイズ',
  order_color: 'カラー',
  order_simple_instruction: '■簡潔指示',
  order_detail_instruction: '▲具体指示',
  order_quantity_condition: '数量条件指定',
  order_note: '補足情報',
  order_memo_1: 'オーダー1',
  rakumart_url_1: 'RM1',
  order_memo_2: 'オーダー2',
  rakumart_url_2: 'RM2',
  order_memo_3: 'オーダー3',
  rakumart_url_3: 'RM3',
  order_memo_4: 'オーダー4',
  rakumart_url_4: 'RM4',
  order_memo_5: 'オーダー5',
  rakumart_url_5: 'RM5',
}


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


function formatNumericValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numericValue = typeof value === 'number' ? value : Number(value)

  if (Number.isFinite(numericValue)) {
    return numericValue.toLocaleString('ja-JP')
  }

  return String(value)
}

function formatClassification(value: string | null | undefined) {
  return value?.trim() || 'NOR'
}

type MonthlySalesEntry = {
  key: string
  label: string
  value: number
}

type MonthlySalesMonth = {
  key: string
  label: string
  value: number
}

type MonthlySalesYearGroup = {
  yearKey: string
  yearLabel: string
  months: MonthlySalesMonth[]
}

function normalizeMonthLabel(year: string, month: string) {
  const normalizedYear = year.replace(/[^0-9]/g, '')
  const normalizedMonth = month.replace(/[^0-9]/g, '').padStart(2, '0')

  if (normalizedYear.length < 4 || !normalizedMonth) {
    return `${year}/${month}`
  }

  return `${normalizedYear.slice(-2)}/${normalizedMonth}`
}

function pushMonthlySalesEntry(
  entries: MonthlySalesEntry[],
  key: string,
  label: string,
  rawValue: unknown,
) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return
  }

  const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue)

  if (!Number.isFinite(numericValue)) {
    return
  }

  entries.push({ key, label, value: numericValue })
}

function parseMonthlySalesSource(monthlySales: unknown) {
  if (!monthlySales) {
    return null
  }

  if (typeof monthlySales === 'string') {
    try {
      return JSON.parse(monthlySales) as unknown
    } catch {
      return null
    }
  }

  return monthlySales
}

function getProductMonthlySales(product: Product) {
  return product.monthly_sales ?? product.monthly_by_year ?? product.monthlyByYear ?? null
}

function getMonthLabelByArrayIndex(index: number) {
  return String(index + 1).padStart(2, '0')
}

function getMonthlySalesEntries(monthlySales: unknown): MonthlySalesEntry[] {
  const source = parseMonthlySalesSource(monthlySales)

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return []
  }

  const entries: MonthlySalesEntry[] = []
  const record = source as Record<string, unknown>

  Object.entries(record).forEach(([yearOrMonthKey, value]) => {
    if (Array.isArray(value)) {
      value.forEach((monthValue, index) => {
        const year = normalizeYearKey(yearOrMonthKey)
        const month = getMonthLabelByArrayIndex(index)
        pushMonthlySalesEntry(entries, `${year}${month}`, `${year.slice(-2)}/${month}`, monthValue)
      })
      return
    }

    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([monthKey, monthValue]) => {
        const year = yearOrMonthKey.replace(/[^0-9]/g, '')
        const month = monthKey.replace(/[^0-9]/g, '').padStart(2, '0')
        const sortKey = `${year}${month}`
        pushMonthlySalesEntry(
          entries,
          sortKey,
          normalizeMonthLabel(yearOrMonthKey, monthKey),
          monthValue,
        )
      })
      return
    }

    const normalizedKey = yearOrMonthKey.replace(/[^0-9]/g, '')
    if (normalizedKey.length >= 6) {
      const year = normalizedKey.slice(0, 4)
      const month = normalizedKey.slice(4, 6)
      pushMonthlySalesEntry(entries, `${year}${month}`, `${year.slice(-2)}/${month}`, value)
      return
    }

    pushMonthlySalesEntry(entries, yearOrMonthKey, yearOrMonthKey, value)
  })

  return entries.sort((a, b) => a.key.localeCompare(b.key, 'ja-JP', { numeric: true }))
}

function formatMonthlySales(monthlySales: unknown) {
  const entries = getMonthlySalesEntries(monthlySales)

  if (entries.length === 0) {
    return '-'
  }

  return entries
    .slice(-6)
    .map((entry) => `${entry.label}:${entry.value.toLocaleString('ja-JP')}`)
    .join(' / ')
}

function normalizeYearKey(year: string) {
  const normalized = year.replace(/[^0-9]/g, '')
  if (normalized.length >= 4) {
    return normalized.slice(0, 4)
  }
  return normalized || year
}

function normalizeMonthKey(month: string) {
  const normalized = month.replace(/[^0-9]/g, '')
  return normalized ? normalized.padStart(2, '0') : month
}

function pushMonthlySalesMonth(
  groupsByYear: Map<string, MonthlySalesYearGroup>,
  year: string,
  month: string,
  rawValue: unknown,
) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return
  }

  const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)

  if (!Number.isFinite(value)) {
    return
  }

  const yearKey = normalizeYearKey(year)
  const monthKey = normalizeMonthKey(month)
  const yearLabel = yearKey.length === 4 ? `${yearKey}年` : `${year}年`
  const monthLabel = monthKey.length === 2 ? `${monthKey}月` : month

  if (!groupsByYear.has(yearKey)) {
    groupsByYear.set(yearKey, { yearKey, yearLabel, months: [] })
  }

  groupsByYear.get(yearKey)?.months.push({
    key: `${yearKey}${monthKey}`,
    label: monthLabel,
    value,
  })
}

function getMonthlySalesYearGroups(monthlySales: unknown): MonthlySalesYearGroup[] {
  const source = parseMonthlySalesSource(monthlySales)

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return []
  }

  const groupsByYear = new Map<string, MonthlySalesYearGroup>()
  const record = source as Record<string, unknown>

  Object.entries(record).forEach(([yearOrMonthKey, value]) => {
    if (Array.isArray(value)) {
      value.forEach((monthValue, index) => {
        pushMonthlySalesMonth(
          groupsByYear,
          yearOrMonthKey,
          getMonthLabelByArrayIndex(index),
          monthValue,
        )
      })
      return
    }

    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([monthKey, monthValue]) => {
        pushMonthlySalesMonth(groupsByYear, yearOrMonthKey, monthKey, monthValue)
      })
      return
    }

    const normalizedKey = yearOrMonthKey.replace(/[^0-9]/g, '')
    if (normalizedKey.length >= 6) {
      pushMonthlySalesMonth(
        groupsByYear,
        normalizedKey.slice(0, 4),
        normalizedKey.slice(4, 6),
        value,
      )
    }
  })

  return Array.from(groupsByYear.values())
    .map((group) => ({
      ...group,
      months: group.months.sort((a, b) => a.key.localeCompare(b.key, 'ja-JP', { numeric: true })),
    }))
    .sort((a, b) => a.yearKey.localeCompare(b.yearKey, 'ja-JP', { numeric: true }))
}

function MonthlySalesByYear({ monthlySales }: { monthlySales: unknown }) {
  const groups = useMemo(() => getMonthlySalesYearGroups(monthlySales), [monthlySales])
  const [selectedYearKey, setSelectedYearKey] = useState<string | null>(null)

  if (groups.length === 0) {
    return <DisplayText value="-" className="monthly-sales-empty" />
  }

  const activeGroup = selectedYearKey
    ? groups.find((group) => group.yearKey === selectedYearKey) ?? null
    : null

  return (
    <div className="monthly-sales-panel">
      <div className="monthly-sales-year-buttons">
        {groups.map((group) => (
          <button
            key={group.yearKey}
            type="button"
            className={`monthly-sales-year-button${group.yearKey === selectedYearKey ? ' is-active' : ''}`}
            onClick={() =>
              setSelectedYearKey((currentYearKey) =>
                currentYearKey === group.yearKey ? null : group.yearKey,
              )
            }
          >
            {group.yearLabel}
          </button>
        ))}
      </div>
      {activeGroup && (
        <div className="monthly-sales-month-grid">
          {activeGroup.months.map((month) => (
            <span key={month.key} className="monthly-sales-month-chip">
              <span>{month.label}</span>
              <strong>{month.value.toLocaleString('ja-JP')}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
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


function buildProductSearchText(product: Product) {
  return [
    product.product_code,
    product.product_name,
    product.floor,
    formatClassification(product.orderboard_classification),
    formatNumericValue(product.free_stock),
    formatNumericValue(product.reorder_point),
    formatNumericValue(product.stock_constant),
    formatMonthlySales(getProductMonthlySales(product)),
    product.special_notes,
    product.picking_advice,
    product.rack_number,
    product.rack_level,
    product.sticker_color,
    product.order_url_1,
    product.order_url_2,
    product.order_url_3,
    product.order_size,
    product.order_color,
    product.order_simple_instruction,
    product.order_detail_instruction,
    product.order_quantity_condition,
    product.order_note,
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
    .join('\n')
    .toLowerCase()
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


function getProductImagePath(productCode: string) {
  return `${productCode.trim()}${PRODUCT_IMAGE_EXTENSION}`
}

function getProductImageUrl(productCode: string, version: number) {
  if (!productCode.trim()) {
    return ''
  }

  const { data } = supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(getProductImagePath(productCode))

  if (!data.publicUrl) {
    return ''
  }

  return version ? `${data.publicUrl}?v=${version}` : data.publicUrl
}

function getProductCodeFromImageFile(file: File) {
  return file.name.replace(/\.[^.]+$/, '').trim()
}

function isSupportedProductImageFile(file: File) {
  const fileName = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  return (
    fileType === 'image/jpeg' ||
    fileType === 'image/png' ||
    fileType === 'image/webp' ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.webp')
  )
}

async function convertImageFileToWebp(file: File) {
  const imageBitmap = await createImageBitmap(file)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = imageBitmap.width
    canvas.height = imageBitmap.height

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('画像変換用のCanvasを作成できませんでした。')
    }

    context.drawImage(imageBitmap, 0, 0)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('WebP変換に失敗しました。'))
          }
        },
        'image/webp',
        PRODUCT_IMAGE_WEBP_QUALITY,
      )
    })
  } finally {
    imageBitmap.close()
  }
}

async function uploadProductImageFile(productCode: string, file: File) {
  const webpBlob = await convertImageFileToWebp(file)
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(getProductImagePath(productCode), webpBlob, {
      cacheControl: '3600',
      contentType: 'image/webp',
      upsert: true,
    })

  if (error) {
    throw new Error(error.message)
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) {
        await worker(item)
      }
    }
  })

  await Promise.all(workers)
}

function ProductImageCell({
  product,
  version,
  isEditing,
  draftImage,
  onPreview,
  onImageFilesDrop,
}: {
  product: Product
  version: number
  isEditing: boolean
  draftImage?: ProductImageDraft
  onPreview: (preview: ProductImagePreview) => void
  onImageFilesDrop: (product: Product, files: File[]) => void
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const imageUrl = getProductImageUrl(product.product_code, version)
  const displayUrl = draftImage?.previewUrl ?? imageUrl
  const hasError = Boolean(displayUrl && failedImageUrl === displayUrl)
  const shouldShowImage = Boolean(displayUrl) && !hasError

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!isEditing) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null

    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!isEditing) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    onImageFilesDrop(product, Array.from(event.dataTransfer.files ?? []))
  }

  const dropClassName = [
    'product-image-drop-target',
    isEditing ? 'is-editing' : '',
    isDragOver ? 'is-drag-over' : '',
    draftImage ? 'is-pending' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={dropClassName}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={isEditing ? '画像をドロップして保存待ちにする' : undefined}
    >
      {shouldShowImage ? (
        <button
          type="button"
          className="product-image-button"
          onClick={() =>
            onPreview({
              productCode: product.product_code,
              productName: product.product_name,
              url: displayUrl,
            })
          }
          title={draftImage ? '保存待ち画像をプレビュー' : '画像をプレビュー'}
        >
          <img
            src={displayUrl}
            alt={product.product_name || product.product_code}
            loading="lazy"
            onError={() => setFailedImageUrl(displayUrl)}
          />
        </button>
      ) : (
        <span className={isEditing ? 'product-image-placeholder is-editing' : 'product-image-placeholder'}>
          {isEditing ? '画像\nドロップ' : '画像なし'}
        </span>
      )}

      {draftImage && <span className="product-image-pending-badge">未保存</span>}
    </div>
  )
}

function UrlEditCell({
  value,
  onChange,
  placeholder = 'URL',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="url-edit-cell">
      <input
        className="table-input url-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function currentJstYearMonth(): { year: number; month: number } {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number)

  return { year, month }
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta
  const normalizedMonth = ((zeroBased % 12) + 12) % 12

  return { year: Math.floor(zeroBased / 12), month: normalizedMonth + 1 }
}

function makeYearMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function buildSelectableNeMonths(range = 24) {
  const end = currentJstYearMonth()
  const result: string[] = []

  for (let index = range - 1; index >= 0; index -= 1) {
    const value = addMonths(end.year, end.month, -index)
    if (value.year >= NE_SYNC_MONTH_MIN_YEAR) {
      result.push(makeYearMonthKey(value.year, value.month))
    }
  }

  return result
}

function groupYearMonths(yearMonths: string[]) {
  const map = new Map<string, string[]>()

  yearMonths.forEach((key) => {
    const [year] = key.split('-')
    if (!year) {
      return
    }
    map.set(year, [...(map.get(year) ?? []), key])
  })

  return Array.from(map.entries()).map(([year, months]) => ({ year, months }))
}

function selectedNeOperationalFieldKeys(fields: NeSyncFieldState): NeOperationalFieldKey[] {
  const result: NeOperationalFieldKey[] = []

  if (fields.freeStock) {
    result.push('free_stock')
  }
  if (fields.reorderPoint) {
    result.push('reorder_point')
  }
  if (fields.stockConstant) {
    result.push('stock_constant')
  }

  return result
}


function safeParseColumnWidths(raw: string | null): ColumnWidthMap {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
        .map(([key, value]) => [key, clampColumnWidth(value as number)]),
    )
  } catch {
    return {}
  }
}

function clampColumnWidth(width: number) {
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(width)))
}

function isSortableColumn(key: string): key is SortableColumnKey {
  return SORTABLE_COLUMN_SET.has(key)
}

function getProductSortValue(product: Product, key: SortableColumnKey): string | number | null {
  switch (key) {
    case 'free_stock':
    case 'reorder_point':
    case 'stock_constant':
      return product[key]
    case 'orderboard_classification':
      return formatClassification(product.orderboard_classification)
    case 'product_code':
      return product.product_code
    case 'product_name':
      return product.product_name
    case 'floor':
      return product.floor
    case 'rack_number':
      return product.rack_number
    case 'rack_level':
      return product.rack_level
    case 'sticker_color':
      return product.sticker_color
    case 'order_memo_1':
      return product.order_memo_1
    case 'order_memo_2':
      return product.order_memo_2
    case 'order_memo_3':
      return product.order_memo_3
    case 'order_memo_4':
      return product.order_memo_4
    case 'order_memo_5':
      return product.order_memo_5
    default:
      return null
  }
}

function isBlankSortValue(value: string | number | null) {
  return value === null || value === undefined || String(value).trim() === ''
}

function compareProductsBySort(productA: Product, productB: Product, config: Exclude<SortConfig, null>) {
  const valueA = getProductSortValue(productA, config.key)
  const valueB = getProductSortValue(productB, config.key)
  const isBlankA = isBlankSortValue(valueA)
  const isBlankB = isBlankSortValue(valueB)

  if (isBlankA && isBlankB) {
    return productA.product_code.localeCompare(productB.product_code, 'ja', { numeric: true, sensitivity: 'base' })
  }

  if (isBlankA) {
    return 1
  }

  if (isBlankB) {
    return -1
  }

  const numericColumns: SortableColumnKey[] = ['free_stock', 'reorder_point', 'stock_constant']
  const baseResult = numericColumns.includes(config.key)
    ? Number(valueA) - Number(valueB)
    : String(valueA).localeCompare(String(valueB), 'ja', { numeric: true, sensitivity: 'base' })

  const result = baseResult === 0
    ? productA.product_code.localeCompare(productB.product_code, 'ja', { numeric: true, sensitivity: 'base' })
    : baseResult

  return config.direction === 'asc' ? result : -result
}

function getNeColumnSpecs(): ColumnSpec[] {
  return [
    { key: 'free_stock', label: 'フリー在庫', width: 96 },
    { key: 'reorder_point', label: '発注点', width: 92 },
    { key: 'stock_constant', label: '在庫定数', width: 96 },
    { key: 'monthly_sales', label: '月別受注数', width: 280 },
    { key: 'orderboard_classification', label: '分類', width: 92 },
  ]
}

function getViewColumnSpecs(tableView: TableView): ColumnSpec[] {
  const baseColumns: ColumnSpec[] = [
    { key: 'image', label: '画像', width: 86, className: 'image-cell sticky-image-cell' },
    { key: 'product_code', label: '商品コード', width: 190, className: 'sticky-code-cell' },
  ]
  const actionColumn: ColumnSpec = { key: 'actions', label: '操作', width: 122 }
  const neColumns = getNeColumnSpecs()

  const viewColumns: Record<TableView, ColumnSpec[]> = {
    all: [
      { key: 'product_name', label: '商品名', width: 280 },
      ...neColumns,
      { key: 'floor', label: '階数', width: 84 },
      { key: 'special_notes', label: '特記事項', width: 240 },
      { key: 'picking_advice', label: 'ピック時アドバイス', width: 260 },
      { key: 'rack_number', label: '棚番号-位置', width: 118 },
      { key: 'rack_level', label: '棚番号-段', width: 108 },
      { key: 'sticker_color', label: 'シールカラー', width: 118 },
      { key: 'order_memo_1', label: 'オーダー1', width: 150 },
      { key: 'order_memo_2', label: 'オーダー2', width: 150 },
      { key: 'order_memo_3', label: 'オーダー3', width: 150 },
      { key: 'order_memo_4', label: 'オーダー4', width: 150 },
      { key: 'order_memo_5', label: 'オーダー5', width: 150 },
      { key: 'product_info_synced_at', label: '商品同期', width: 160 },
      { key: 'order_status_synced_at', label: 'オーダー同期', width: 160 },
      { key: 'updated_at', label: '更新日', width: 160 },
    ],
    pick: [
      { key: 'product_name', label: '商品名', width: 280 },
      { key: 'special_notes', label: '特記事項', width: 260 },
      { key: 'picking_advice', label: 'ピック時アドバイス', width: 300 },
      { key: 'floor', label: '階数', width: 84 },
      { key: 'rack_number', label: '棚番号-位置', width: 120 },
      { key: 'rack_level', label: '棚番号-段', width: 108 },
      { key: 'sticker_color', label: 'シールカラー', width: 118 },
    ],
    order: [
      { key: 'product_name', label: '商品名', width: 280 },
      { key: 'order_memo_1', label: 'オーダー1', width: 170 },
      { key: 'order_memo_2', label: 'オーダー2', width: 170 },
      { key: 'order_memo_3', label: 'オーダー3', width: 170 },
      { key: 'order_memo_4', label: 'オーダー4', width: 170 },
      { key: 'order_memo_5', label: 'オーダー5', width: 170 },
    ],
    purchase: [
      { key: 'product_name', label: '商品名', width: 280 },
      { key: 'order_url_1', label: '発注URL1', width: 250 },
      { key: 'order_url_2', label: '発注URL2', width: 250 },
      { key: 'order_url_3', label: '発注URL3', width: 250 },
      { key: 'order_size', label: 'サイズ', width: 96 },
      { key: 'order_color', label: 'カラー', width: 110 },
      { key: 'order_simple_instruction', label: '■簡潔指示', width: 260 },
      { key: 'order_detail_instruction', label: '▲具体指示', width: 320 },
      { key: 'order_quantity_condition', label: '数量条件指定', width: 220 },
      { key: 'order_note', label: '補足情報', width: 260 },
    ],
    ne: [
      { key: 'product_name', label: '商品名', width: 280 },
      ...neColumns,
    ],
    custom: [
      { key: 'product_name', label: '商品名', width: 280 },
      ...neColumns,
      { key: 'floor', label: '階数', width: 84 },
      { key: 'rack_number', label: '棚番号-位置', width: 120 },
      { key: 'rack_level', label: '棚番号-段', width: 108 },
      { key: 'sticker_color', label: 'シールカラー', width: 118 },
      { key: 'special_notes', label: '特記事項', width: 260 },
      { key: 'picking_advice', label: 'ピック時アドバイス', width: 300 },
      { key: 'order_memo_1', label: 'オーダー1', width: 170 },
      { key: 'updated_at', label: '更新日', width: 160 },
    ],
  }

  return [...baseColumns, ...viewColumns[tableView], actionColumn]
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
  const [secretAnswer, setSecretAnswer] = useState('')
  const [authQuestion, setAuthQuestion] = useState(DEFAULT_AUTH_QUESTION)
  const [authDisplayName, setAuthDisplayName] = useState('秘密の質問ログイン')

  const [products, setProducts] = useState<Product[]>([])
  const [rowDrafts, setRowDrafts] = useState<Record<string, EditableProduct>>({})
  const [editingCodes, setEditingCodes] = useState<Set<string>>(() => new Set())
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [tableView, setTableView] = useState<TableView>('order')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<SortConfig>(null)
  const [columnWidths, setColumnWidths] = useState<ColumnWidthMap>(() =>
    safeParseColumnWidths(window.localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY)),
  )

  const [loading, setLoading] = useState(false)
  const [savingCode, setSavingCode] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const [neSyncLoading, setNeSyncLoading] = useState(false)
  const [neSyncMessage, setNeSyncMessage] = useState('')
  const [neUsage, setNeUsage] = useState<NeUsageResult | null>(null)
  const [neSyncResult, setNeSyncResult] = useState<NeOperationalSyncResult | null>(null)
  const [neMonthlyResult, setNeMonthlyResult] = useState<NeMonthlySalesSyncResult | null>(null)
  const [neSyncFields, setNeSyncFields] = useState<NeSyncFieldState>(() =>
    safeParseJson<NeSyncFieldState>(
      window.localStorage.getItem(NE_SYNC_FIELDS_STORAGE_KEY),
      DEFAULT_NE_SYNC_FIELDS,
    ),
  )
  const [selectedNeMonths, setSelectedNeMonths] = useState<string[]>(() => {
    const monthOptions = buildSelectableNeMonths(24)
    const storedMonths = safeParseJson<string[]>(window.localStorage.getItem(NE_SYNC_MONTHS_STORAGE_KEY), [])
      .filter((month) => monthOptions.includes(month))

    return storedMonths.length ? storedMonths : monthOptions.slice(-1)
  })
  const [isNeSyncPanelOpen, setIsNeSyncPanelOpen] = useState(false)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkProductRow[]>(() =>
    createBulkRows(),
  )
  const [bulkImageDrafts, setBulkImageDrafts] = useState<Record<string, ProductImageDraft>>({})
  const bulkImageDraftsRef = useRef<Record<string, ProductImageDraft>>({})
  const [bulkShouldUpdateExisting, setBulkShouldUpdateExisting] = useState(false)
  const [selectedBulkFields, setSelectedBulkFields] = useState<BulkFieldKey[]>(
    DEFAULT_BULK_FIELD_KEYS,
  )
  const [csvColumnMapping, setCsvColumnMapping] = useState<CsvColumnMapping | null>(null)
  const [isCsvDragOver, setIsCsvDragOver] = useState(false)
  const [modalMessage, setModalMessage] = useState('')

  const [isImageImportModalOpen, setIsImageImportModalOpen] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [isImageDragOver, setIsImageDragOver] = useState(false)
  const [imageImporting, setImageImporting] = useState(false)
  const [imageImportMessage, setImageImportMessage] = useState('')
  const [imageCacheVersion, setImageCacheVersion] = useState(() => Date.now())
  const [imagePreview, setImagePreview] = useState<ProductImagePreview | null>(null)
  const [imageDrafts, setImageDrafts] = useState<Record<string, ProductImageDraft>>({})
  const imageDraftsRef = useRef<Record<string, ProductImageDraft>>({})

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
    imageDraftsRef.current = imageDrafts
  }, [imageDrafts])

  useEffect(() => {
    bulkImageDraftsRef.current = bulkImageDrafts
  }, [bulkImageDrafts])

  useEffect(() => () => {
    Object.values(imageDraftsRef.current).forEach((draft) => {
      URL.revokeObjectURL(draft.previewUrl)
    })
    Object.values(bulkImageDraftsRef.current).forEach((draft) => {
      URL.revokeObjectURL(draft.previewUrl)
    })
  }, [])

  useEffect(() => {
    let isMounted = true

    async function fetchAuthQuestion() {
      if (!AUTH_API_BASE_URL) {
        setAuthQuestion(DEFAULT_AUTH_QUESTION)
        return
      }

      try {
        const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/question`, {
          method: 'GET',
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => ({}))) as SecretQuestionResponse
        if (!isMounted) return
        if (response.ok && payload.ok) {
          setAuthQuestion(payload.question || DEFAULT_AUTH_QUESTION)
          setAuthDisplayName(payload.displayName || '秘密の質問ログイン')
        }
      } catch {
        if (isMounted) setAuthQuestion(DEFAULT_AUTH_QUESTION)
      }
    }

    fetchAuthQuestion()

    return () => {
      isMounted = false
    }
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
    window.localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    window.localStorage.setItem(NE_SYNC_FIELDS_STORAGE_KEY, JSON.stringify(neSyncFields))
  }, [neSyncFields])


  const neMonthOptions = useMemo(() => buildSelectableNeMonths(24), [])
  const neMonthGroups = useMemo(() => groupYearMonths(neMonthOptions), [neMonthOptions])

  useEffect(() => {
    const validSelectedMonths = selectedNeMonths.filter((month) => neMonthOptions.includes(month))
    if (validSelectedMonths.length !== selectedNeMonths.length) {
      setSelectedNeMonths(validSelectedMonths.length ? validSelectedMonths : neMonthOptions.slice(-1))
      return
    }

    window.localStorage.setItem(NE_SYNC_MONTHS_STORAGE_KEY, JSON.stringify(validSelectedMonths))
  }, [neMonthOptions, selectedNeMonths])


  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword)
    }, 220)

    return () => window.clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedKeyword, tableView, sortConfig])

  useEffect(() => {
    setRowDrafts((prev) => {
      const nextDrafts: Record<string, EditableProduct> = {}

      products.forEach((product) => {
        nextDrafts[product.product_code] =
          editingCodes.has(product.product_code) && prev[product.product_code]
            ? prev[product.product_code]
            : productToDraft(product)
      })

      return nextDrafts
    })
  }, [products, editingCodes])

  const existingProductCodes = useMemo(() => {
    return new Set(products.map((product) => product.product_code))
  }, [products])

  const productCodeLookup = useMemo(() => {
    return new Map(
      products.map((product) => [product.product_code.toLowerCase(), product.product_code]),
    )
  }, [products])

  const productByCode = useMemo(() => {
    return new Map(products.map((product) => [product.product_code, product]))
  }, [products])

  const productSearchTextByCode = useMemo(() => {
    return new Map(
      products.map((product) => [product.product_code, buildProductSearchText(product)]),
    )
  }, [products])

  const bulkSummary = useMemo(() => {
    return buildBulkSummary(bulkRows, existingProductCodes)
  }, [bulkRows, existingProductCodes])

  const selectedBulkColumns = useMemo(() => {
    return BULK_FIELD_COLUMNS.filter((column) =>
      selectedBulkFields.includes(column.key),
    )
  }, [selectedBulkFields])

  const bulkImageDraftCount = Object.keys(bulkImageDrafts).length


  const bulkInsertableCount = bulkSummary.insertRows.length
  const bulkUpdateableCount = bulkSummary.updateRows.length
  const bulkExistingCount = bulkSummary.existingCount
  const bulkActionableCount = bulkShouldUpdateExisting
    ? bulkSummary.uniqueRows.length
    : bulkInsertableCount

  const filteredProducts = useMemo(() => {
    const q = debouncedKeyword.trim().toLowerCase()

    if (!q) {
      return products
    }

    return products.filter((product) =>
      (productSearchTextByCode.get(product.product_code) ?? '').includes(q),
    )
  }, [products, productSearchTextByCode, debouncedKeyword])



  const sortedProducts = useMemo(() => {
    if (!sortConfig) {
      return filteredProducts
    }

    return [...filteredProducts].sort((productA, productB) =>
      compareProductsBySort(productA, productB, sortConfig),
    )
  }, [filteredProducts, sortConfig])

  const totalProductCount = sortedProducts.length
  const totalPages = Math.max(1, Math.ceil(totalProductCount / PRODUCT_PAGE_SIZE))
  const currentPageNumber = Math.min(currentPage, totalPages)
  const pageStartIndex = (currentPageNumber - 1) * PRODUCT_PAGE_SIZE
  const pageEndIndex = Math.min(pageStartIndex + PRODUCT_PAGE_SIZE, totalProductCount)
  const pagerRangeText =
    totalProductCount === 0
      ? '0件 / 全0件'
      : `${pageStartIndex + 1}〜${pageEndIndex}件目 / 全${totalProductCount}件`

  const pagedProducts = useMemo(() => {
    return sortedProducts.slice(pageStartIndex, pageEndIndex)
  }, [sortedProducts, pageStartIndex, pageEndIndex])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  async function login() {
    setLoading(true)
    setMessage('')

    if (!AUTH_API_BASE_URL) {
      setMessage('ログインAPIが未設定です。VITE_AUTH_API_BASE_URLを設定してください。')
      setLoading(false)
      return
    }

    if (!secretAnswer.trim()) {
      setMessage('回答を入力してください。')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: secretAnswer.trim() }),
      })
      const payload = (await response.json().catch(() => ({}))) as SecretLoginResponse

      if (!response.ok || !payload.ok || !payload.session?.access_token || !payload.session.refresh_token) {
        throw new Error(payload.error || 'ログインに失敗しました。')
      }

      const { error } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      })

      if (error) throw error

      setSecretAnswer('')
      setUser({ email: payload.email || payload.user?.email || authDisplayName })
    } catch (error) {
      setMessage(`ログイン失敗: ${error instanceof Error ? error.message : 'ログインに失敗しました。'}`)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setProducts([])
    setRowDrafts({})
    setEditingCodes(new Set())
    setUser(null)
  }

  async function fetchProducts() {
    setLoading(true)
    setMessage('')

    const allProducts: Product[] = []
    let from = 0

    while (true) {
      const to = from + PRODUCT_FETCH_BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_code', { ascending: true })
        .range(from, to)

      if (error) {
        setMessage(`取得失敗: ${error.message}`)
        setLoading(false)
        return
      }

      const batch = (data ?? []) as Product[]
      allProducts.push(...batch)

      if (batch.length < PRODUCT_FETCH_BATCH_SIZE) {
        break
      }

      from += PRODUCT_FETCH_BATCH_SIZE
    }

    setProducts(allProducts)
    setCurrentPage(1)
    setLoading(false)
  }

  async function callNeWorker<T>(path: string, params: Record<string, string> = {}) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (sessionError || !accessToken) {
      throw new Error('ログインセッションが切れています。再ログインしてください。')
    }

    const url = new URL(path, NE_SYNC_WORKER_URL)
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value)
      }
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = (await response.json().catch(() => null)) as T | null

    if (!response.ok || !data) {
      const detail = data && typeof data === 'object' && 'error' in data ? String((data as { error?: unknown }).error ?? '') : response.statusText
      throw new Error(detail || `NE連携Workerでエラーが発生しました。status=${response.status}`)
    }

    return data
  }

  async function fetchNeUsage() {
    setNeSyncLoading(true)
    setNeSyncMessage('NE API利用状況を取得しています...')

    try {
      const usage = await callNeWorker<NeUsageResult>('/api/ne/usage')
      setNeUsage(usage)
      setNeSyncMessage(`今月のNE API利用回数：${usage.callCount ?? 0}回 / 残り${usage.remainingCalls ?? '-'}回`)
    } catch (error) {
      setNeSyncMessage(`利用状況取得失敗：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setNeSyncLoading(false)
    }
  }

  function updateNeSyncField(key: keyof NeSyncFieldState, checked: boolean) {
    setNeSyncFields((current) => ({ ...current, [key]: checked }))
  }

  function toggleNeSyncMonth(key: string, checked: boolean) {
    setSelectedNeMonths((current) => {
      const next = checked ? Array.from(new Set([...current, key])) : current.filter((month) => month !== key)
      return next.sort()
    })
  }

  function selectRecentNeMonths(count: number) {
    setSelectedNeMonths(neMonthOptions.slice(Math.max(0, neMonthOptions.length - count)))
    setNeSyncFields((current) => ({ ...current, monthlySales: true }))
  }

  async function syncNeOperationalFields(dryRun: boolean) {
    const operationalFields = selectedNeOperationalFieldKeys(neSyncFields)
    const shouldSyncOperational = operationalFields.length > 0
    const shouldSyncMonthly = neSyncFields.monthlySales

    if (!shouldSyncOperational && !shouldSyncMonthly) {
      setNeSyncMessage('取得項目を1つ以上選択してください。')
      return
    }

    if (shouldSyncMonthly && selectedNeMonths.length === 0) {
      setNeSyncMessage('月別受注数を取得する年月を1つ以上選択してください。')
      return
    }

    setNeSyncLoading(true)
    setNeSyncMessage(dryRun ? 'NE取得のdry-runを実行しています...' : 'NEから選択項目を取得してSupabaseへ反映しています...')
    setNeSyncResult(null)
    setNeMonthlyResult(null)

    try {
      let operationalResult: NeOperationalSyncResult | null = null
      let monthlyResult: NeMonthlySalesSyncResult | null = null

      if (shouldSyncOperational) {
        operationalResult = await callNeWorker<NeOperationalSyncResult>('/api/ne/sync-operational-fields', {
          ...(dryRun ? { dryRun: '1' } : {}),
          fields: operationalFields.join(','),
        })
        setNeSyncResult(operationalResult)
      }

      if (shouldSyncMonthly) {
        monthlyResult = await callNeWorker<NeMonthlySalesSyncResult>('/api/ne/sync-monthly-sales', {
          ...(dryRun ? { dryRun: '1' } : {}),
          yearMonths: selectedNeMonths.join(','),
        })
        setNeMonthlyResult(monthlyResult)
      }

      const messageParts: string[] = []
      if (operationalResult) {
        messageParts.push(`NE情報：一致 ${operationalResult.matched ?? 0}件 / 更新 ${operationalResult.updated ?? 0}件`)
      }
      if (monthlyResult) {
        messageParts.push(`月別：${monthlyResult.months?.join('・') || '-'} / 一致 ${monthlyResult.matched ?? 0}件 / 更新 ${monthlyResult.updated ?? 0}件`)
      }

      setNeSyncMessage(`${dryRun ? 'dry-run完了' : 'NE取得完了'}：${messageParts.join(' / ')}`)

      if (!dryRun && ((operationalResult && operationalResult.ok) || (monthlyResult && monthlyResult.ok))) {
        await fetchProducts()
      }
    } catch (error) {
      setNeSyncMessage(`NE取得失敗：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setNeSyncLoading(false)
    }
  }

  async function copyProductCode(productCode: string) {
    try {
      await navigator.clipboard.writeText(productCode)
      setMessage(`商品コードをコピーしました：${productCode}`)
    } catch {
      setMessage('コピーに失敗しました。')
    }
  }

  function clearBulkImageDrafts(rowIds?: string[]) {
    setBulkImageDrafts((prev) => {
      const next = { ...prev }
      const targetRowIds = rowIds ?? Object.keys(next)
      let changed = false

      targetRowIds.forEach((rowId) => {
        const draft = next[rowId]

        if (draft) {
          URL.revokeObjectURL(draft.previewUrl)
          delete next[rowId]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }

  function setBulkRowImageDraft(rowId: string, files: File[]) {
    const imageFile = files.find(isSupportedProductImageFile)

    if (!imageFile) {
      setModalMessage('jpg / png / webp 形式の画像をドロップしてください。')
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)

    setBulkImageDrafts((prev) => {
      const previousDraft = prev[rowId]

      if (previousDraft) {
        URL.revokeObjectURL(previousDraft.previewUrl)
      }

      return {
        ...prev,
        [rowId]: {
          file: imageFile,
          previewUrl,
          sourceName: imageFile.name,
        },
      }
    })

    setModalMessage('画像を保存待ちにしました。商品コード入力後、一括追加/更新で反映します。')
  }

  function handleBulkImageDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleBulkImageDrop(event: DragEvent<HTMLDivElement>, rowId: string) {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files ?? [])

    if (files.length === 0) {
      setModalMessage('画像ファイルをドロップしてください。')
      return
    }

    setBulkRowImageDraft(rowId, files)
  }

  function handleBulkImageFileSelect(event: ChangeEvent<HTMLInputElement>, rowId: string) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''

    if (files.length > 0) {
      setBulkRowImageDraft(rowId, files)
    }
  }

  function openCreateModal() {
    clearBulkImageDrafts()
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
    clearBulkImageDrafts()
    setBulkRows(createBulkRows())
    setBulkShouldUpdateExisting(false)
    setSelectedBulkFields(DEFAULT_BULK_FIELD_KEYS)
    setCsvColumnMapping(null)
    setIsCsvDragOver(false)
    setModalMessage('')
  }


  function openImageImportModal() {
    setImageFiles([])
    setIsImageDragOver(false)
    setImageImportMessage('')
    setIsImageImportModalOpen(true)
  }

  function closeImageImportModal() {
    if (imageImporting) {
      return
    }

    setIsImageImportModalOpen(false)
    setImageFiles([])
    setIsImageDragOver(false)
    setImageImportMessage('')
  }

  function removeImageDrafts(productCodes: string[]) {
    if (productCodes.length === 0) {
      return
    }

    const productCodeSet = new Set(productCodes)

    setImageDrafts((prev) => {
      let changed = false
      const next = { ...prev }

      productCodeSet.forEach((productCode) => {
        const draft = next[productCode]

        if (draft) {
          URL.revokeObjectURL(draft.previewUrl)
          delete next[productCode]
          changed = true
        }
      })

      return changed ? next : prev
    })
  }

  function setRowImageDraft(product: Product, files: File[]) {
    if (!editingCodes.has(product.product_code)) {
      setMessage('画像更新は編集モード中のみ受付できます。')
      return
    }

    const imageFile = files.find(isSupportedProductImageFile)

    if (!imageFile) {
      setMessage('jpg / png / webp 形式の画像をドロップしてください。')
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)

    setImageDrafts((prev) => {
      const previousDraft = prev[product.product_code]

      if (previousDraft) {
        URL.revokeObjectURL(previousDraft.previewUrl)
      }

      return {
        ...prev,
        [product.product_code]: {
          file: imageFile,
          previewUrl,
          sourceName: imageFile.name,
        },
      }
    })

    setMessage(`${product.product_code} の画像を保存待ちにしました。保存で反映します。`)
  }

  function setProductImageFiles(files: File[]) {
    const supportedFiles = files.filter(isSupportedProductImageFile)
    const skippedCount = files.length - supportedFiles.length

    setImageFiles(supportedFiles)

    if (supportedFiles.length === 0) {
      setImageImportMessage('商品コード付きの jpg / png / webp 画像を選択してください。')
      return
    }

    setImageImportMessage(
      skippedCount > 0
        ? `${supportedFiles.length}件の画像を選択しました。非対応ファイルは${skippedCount}件スキップします。保存時はWebPに変換します。`
        : `${supportedFiles.length}件の画像を選択しました。保存時はWebPに変換します。`,
    )
  }

  function handleImageFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''

    if (files.length > 0) {
      setProductImageFiles(files)
    }
  }

  function handleImageDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsImageDragOver(true)
  }

  function handleImageDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null

    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsImageDragOver(false)
    }
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsImageDragOver(false)

    const files = Array.from(event.dataTransfer.files ?? [])

    if (files.length === 0) {
      setImageImportMessage('商品コード付きの jpg / png / webp 画像をドロップしてください。')
      return
    }

    setProductImageFiles(files)
  }

  async function uploadProductImages() {
    if (imageFiles.length === 0) {
      setImageImportMessage('アップロードする画像を選択してください。')
      return
    }

    setImageImporting(true)
    setImageImportMessage('画像をアップロードしています...')

    let uploadedCount = 0
    let skippedCount = 0
    let failedCount = 0
    const failedNames: string[] = []

    await runWithConcurrency(imageFiles, IMAGE_UPLOAD_CONCURRENCY, async (file) => {
      const rawProductCode = getProductCodeFromImageFile(file)
      const productCode = productCodeLookup.get(rawProductCode.toLowerCase())

      if (!productCode) {
        skippedCount += 1
        return
      }

      try {
        await uploadProductImageFile(productCode, file)
        uploadedCount += 1
      } catch {
        failedCount += 1
        failedNames.push(file.name)
      }
    })

    setImageImporting(false)
    setImageCacheVersion(Date.now())

    const resultMessage = `画像アップロード完了：${uploadedCount}件 / 未登録スキップ：${skippedCount}件 / 失敗：${failedCount}件`
    setImageImportMessage(
      failedNames.length > 0
        ? `${resultMessage}（例：${failedNames.slice(0, 3).join('、')}）`
        : resultMessage,
    )
    setMessage(resultMessage)
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
    clearBulkImageDrafts([rowId])
    setBulkRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId)
      return next.length > 0 ? next : createBulkRows(1)
    })
  }

  function clearBulkRows() {
    clearBulkImageDrafts()
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

    clearBulkImageDrafts()
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
    setEditingCodes((prev) => {
      const next = new Set(prev)
      next.add(product.product_code)
      return next
    })
    setRowDrafts((prev) => ({
      ...prev,
      [product.product_code]: prev[product.product_code] ?? productToDraft(product),
    }))
    setMessage('')
  }

  function startBulkEdit() {
    if (products.length === 0) {
      return
    }

    setEditingCodes(new Set(products.map((product) => product.product_code)))
    setRowDrafts((prev) => {
      const next = { ...prev }

      products.forEach((product) => {
        next[product.product_code] = next[product.product_code] ?? productToDraft(product)
      })

      return next
    })
    setMessage(`${products.length}件を編集モードにしました。`)
  }

  function updateDraft(
    productCode: string,
    key: EditableProductKey,
    value: string,
  ) {
    const product = productByCode.get(productCode)

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

  function hasRowChanges(product: Product, draft: EditableProduct) {
    return isDraftDirty(product, draft) || Boolean(imageDrafts[product.product_code])
  }

  function cancelEdit(product: Product) {
    removeImageDrafts([product.product_code])
    setRowDrafts((prev) => ({
      ...prev,
      [product.product_code]: productToDraft(product),
    }))
    setEditingCodes((prev) => {
      const next = new Set(prev)
      next.delete(product.product_code)
      return next
    })
    setMessage(`編集をキャンセルしました：${product.product_code}`)
  }

  function cancelAllEdits() {
    if (editingCodes.size === 0 || savingCode) {
      return
    }

    const cancelCount = editingCodes.size

    removeImageDrafts(Array.from(editingCodes))
    setRowDrafts((prev) => {
      const next = { ...prev }

      products.forEach((product) => {
        if (editingCodes.has(product.product_code)) {
          next[product.product_code] = productToDraft(product)
        }
      })

      return next
    })
    setEditingCodes(new Set())
    setMessage(`${cancelCount}件の編集をキャンセルしました。`)
  }

  async function saveAllEdits() {
    if (editingCodes.size === 0 || savingCode) {
      return
    }

    const editingProducts = products.filter((product) =>
      editingCodes.has(product.product_code),
    )
    const dirtyProducts = editingProducts.filter((product) =>
      hasRowChanges(
        product,
        rowDrafts[product.product_code] ?? productToDraft(product),
      ),
    )
    const cleanCount = editingProducts.length - dirtyProducts.length

    if (dirtyProducts.length === 0) {
      removeImageDrafts(Array.from(editingCodes))
      setRowDrafts((prev) => {
        const next = { ...prev }

        editingProducts.forEach((product) => {
          next[product.product_code] = productToDraft(product)
        })

        return next
      })
      setEditingCodes(new Set())
      setMessage(`${cleanCount}件の編集をキャンセルしました。変更はありません。`)
      return
    }

    setSavingCode('__bulk_save__')
    setMessage('')

    const now = new Date().toISOString()
    const payload = dirtyProducts.map((product) => ({
      product_code: product.product_code,
      ...normalizeDraft(rowDrafts[product.product_code] ?? productToDraft(product)),
      updated_at: now,
    }))

    const { error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'product_code' })

    if (error) {
      setMessage(`すべて保存失敗: ${error.message}`)
      setSavingCode(null)
      return
    }

    const imageProducts = dirtyProducts.filter((product) => imageDrafts[product.product_code])
    const failedImageCodes = new Set<string>()
    const failedImageNames: string[] = []

    await runWithConcurrency(imageProducts, IMAGE_UPLOAD_CONCURRENCY, async (product) => {
      const imageDraft = imageDrafts[product.product_code]

      if (!imageDraft) {
        return
      }

      try {
        await uploadProductImageFile(product.product_code, imageDraft.file)
      } catch {
        failedImageCodes.add(product.product_code)
        failedImageNames.push(`${product.product_code}（${imageDraft.sourceName}）`)
      }
    })

    const successfulImageCodes = imageProducts
      .map((product) => product.product_code)
      .filter((productCode) => !failedImageCodes.has(productCode))

    if (successfulImageCodes.length > 0) {
      removeImageDrafts(successfulImageCodes)
      setImageCacheVersion(Date.now())
    }

    setRowDrafts((prev) => {
      const next = { ...prev }

      editingProducts.forEach((product) => {
        if (!failedImageCodes.has(product.product_code)) {
          next[product.product_code] = productToDraft(product)
        }
      })

      return next
    })

    if (failedImageCodes.size > 0) {
      setEditingCodes(new Set(failedImageCodes))
      setMessage(
        `保存しましたが、画像アップロード失敗が${failedImageCodes.size}件あります。失敗行は編集モードのまま残しました。例：${failedImageNames.slice(0, 3).join('、')}`,
      )
    } else {
      setEditingCodes(new Set())
      setMessage(
        cleanCount > 0
          ? `${dirtyProducts.length}件保存、${cleanCount}件キャンセルしました。`
          : `${dirtyProducts.length}件保存しました。`,
      )
    }

    await fetchProducts()
    setSavingCode(null)
  }

  async function createBulkProducts() {
    const targetRows = bulkShouldUpdateExisting
      ? bulkSummary.uniqueRows
      : bulkSummary.insertRows
    const targetCodeSet = new Set(targetRows.map((row) => row.product_code))

    if (bulkSummary.filledCount === 0) {
      setModalMessage(
        bulkImageDraftCount > 0
          ? '画像を反映するには商品コードを入力してください。'
          : '追加/更新できる商品がありません。',
      )
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

    const seenCodes = new Set<string>()
    const targetBulkRows = bulkRows
      .map((row) => {
        const cleanRow: CleanBulkProductRow = {
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
        }

        return { row, cleanRow }
      })
      .filter(({ cleanRow }) => {
        if (!cleanRow.product_code || !targetCodeSet.has(cleanRow.product_code) || seenCodes.has(cleanRow.product_code)) {
          return false
        }

        seenCodes.add(cleanRow.product_code)
        return true
      })

    const imageRows = targetBulkRows.filter(({ row }) => bulkImageDrafts[row.id])

    setLoading(true)
    setModalMessage('')

    const now = new Date().toISOString()
    const payload = targetBulkRows.map(({ row, cleanRow }) => {
      const productPayload: Record<string, string | null> = {
        product_code: cleanRow.product_code,
        updated_at: now,
      }
      const hasImageOnlyChange = Boolean(bulkImageDrafts[row.id]) && selectedBulkFields.every((key) => !cleanRow[key])

      if (!hasImageOnlyChange) {
        selectedBulkFields.forEach((key) => {
          productPayload[key] = cleanRow[key] || null
        })
      }

      return productPayload
    })

    const { error } = bulkShouldUpdateExisting
      ? await supabase
          .from('products')
          .upsert(payload, { onConflict: 'product_code' })
      : await supabase.from('products').insert(payload)

    if (error) {
      setModalMessage(`一括追加/更新失敗: ${error.message}`)
      setLoading(false)
      return
    }

    const failedImageRowIds = new Set<string>()
    const failedImageNames: string[] = []

    await runWithConcurrency(imageRows, IMAGE_UPLOAD_CONCURRENCY, async ({ row, cleanRow }) => {
      const imageDraft = bulkImageDrafts[row.id]

      if (!imageDraft) {
        return
      }

      try {
        await uploadProductImageFile(cleanRow.product_code, imageDraft.file)
      } catch {
        failedImageRowIds.add(row.id)
        failedImageNames.push(`${cleanRow.product_code}（${imageDraft.sourceName}）`)
      }
    })

    const successfulImageRowIds = imageRows
      .map(({ row }) => row.id)
      .filter((rowId) => !failedImageRowIds.has(rowId))

    if (successfulImageRowIds.length > 0) {
      clearBulkImageDrafts(successfulImageRowIds)
      setImageCacheVersion(Date.now())
    }

    await fetchProducts()

    if (failedImageRowIds.size > 0) {
      setModalMessage(
        `商品情報は保存しましたが、画像アップロード失敗が${failedImageRowIds.size}件あります。失敗行は残しています。例：${failedImageNames.slice(0, 3).join('、')}`,
      )
      setLoading(false)
      return
    }

    closeCreateModal()
    setMessage(
      bulkShouldUpdateExisting
        ? `${bulkInsertableCount}件追加、${bulkUpdateableCount}件更新しました。画像：${imageRows.length}件`
        : `${bulkInsertableCount}件追加しました。既存商品のスキップ：${bulkExistingCount}件 / 画像：${imageRows.length}件`,
    )
    setLoading(false)
  }

  async function saveRow(product: Product) {
    const draft = rowDrafts[product.product_code]

    if (!draft) {
      setMessage('保存対象が見つかりません。')
      return
    }

    const imageDraft = imageDrafts[product.product_code]

    if (!isDraftDirty(product, draft) && !imageDraft) {
      setMessage('変更はありません。')
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
      setSavingCode(null)
      return
    }

    if (imageDraft) {
      try {
        await uploadProductImageFile(product.product_code, imageDraft.file)
        removeImageDrafts([product.product_code])
        setImageCacheVersion(Date.now())
      } catch (uploadError) {
        setMessage(
          `商品情報は保存しましたが、画像アップロードに失敗しました：${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
        )
        setSavingCode(null)
        return
      }
    }

    setMessage(`保存しました：${product.product_code}`)
    setEditingCodes((prev) => {
      const next = new Set(prev)
      next.delete(product.product_code)
      return next
    })
    await fetchProducts()
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
    const isEditing = editingCodes.has(product.product_code)
    const placeholder = options.placeholder ?? EDIT_FIELD_PLACEHOLDERS[key]

    if (isEditing) {
      if (options.multiline) {
        return (
          <textarea
            className={`table-input table-textarea ${options.inputClassName ?? ''}`}
            value={draft[key]}
            onChange={(event) => updateDraft(product.product_code, key, event.target.value)}
            placeholder={placeholder}
          />
        )
      }

      return (
        <input
          className={`table-input ${options.inputClassName ?? ''}`}
          value={draft[key]}
          onChange={(event) => updateDraft(product.product_code, key, event.target.value)}
          placeholder={placeholder}
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
    const isEditing = editingCodes.has(product.product_code)

    if (isEditing) {
      return (
        <UrlEditCell
          value={draft[key]}
          onChange={(value) => updateDraft(product.product_code, key, value)}
          placeholder={EDIT_FIELD_PLACEHOLDERS[key]}
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
    const isEditing = editingCodes.has(product.product_code)
    const orderLabel = EDIT_FIELD_PLACEHOLDERS[orderKey]
    const rmLabel = EDIT_FIELD_PLACEHOLDERS[urlKey]

    if (isEditing) {
      return (
        <div className="order-edit-stack">
          <input
            className="table-input order-input"
            value={draft[orderKey]}
            onChange={(event) =>
              updateDraft(product.product_code, orderKey, event.target.value)
            }
            placeholder={orderLabel}
          />

          <div className="order-rm-edit-row">
            <span>{rmLabel}</span>
            <UrlEditCell
              value={draft[urlKey]}
              onChange={(value) => updateDraft(product.product_code, urlKey, value)}
              placeholder={rmLabel}
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

  function handleRowDoubleClick(product: Product, event: ReactMouseEvent<HTMLTableRowElement>) {
    const target = event.target instanceof HTMLElement ? event.target : null
    const isInteractiveTarget = Boolean(target?.closest('button, a, input, textarea, select'))

    if (isInteractiveTarget || savingCode) {
      return
    }

    startEdit(product)
  }

  function toggleSort(column: ColumnSpec) {
    if (!isSortableColumn(column.key)) {
      return
    }

    const sortKey = column.key

    setSortConfig((prev) => {
      if (!prev || prev.key !== sortKey) {
        return { key: sortKey, direction: 'asc' }
      }

      return { key: sortKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  function renderActions(product: Product, draft: EditableProduct) {
    const isEditing = editingCodes.has(product.product_code)
    const dirty = isEditing && hasRowChanges(product, draft)
    const isSaving = savingCode === product.product_code

    if (isEditing) {
      return (
        <div className="row-actions">
          <button
            className="small save-button"
            onClick={() => saveRow(product)}
            disabled={!dirty || isSaving || Boolean(savingCode)}
          >
            {isSaving ? '保存中' : '保存'}
          </button>

          <button
            className="secondary small cancel-button"
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
        className="small edit-button"
        onClick={() => startEdit(product)}
        disabled={Boolean(savingCode)}
      >
        編集
      </button>
    )
  }

  const currentColumnSpecs = useMemo(() => getViewColumnSpecs(tableView), [tableView])

  function getColumnWidth(column: ColumnSpec) {
    return columnWidths[column.key] ?? column.width
  }

  function startColumnResize(column: ColumnSpec, event: ColumnResizeMouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getColumnWidth(column)

    document.body.classList.add('is-column-resizing')

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = clampColumnWidth(startWidth + moveEvent.clientX - startX)
      setColumnWidths((prev) => ({ ...prev, [column.key]: nextWidth }))
    }

    const handleMouseUp = () => {
      document.body.classList.remove('is-column-resizing')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function renderColumnHeader(column: ColumnSpec) {
    const sortable = isSortableColumn(column.key)
    const sorted = sortConfig?.key === column.key
    const sortLabel = sorted ? (sortConfig.direction === 'asc' ? '昇順' : '降順') : '未並び替え'
    const className = [
      'resizable-header',
      column.className,
      sortable ? 'is-sortable' : '',
      sorted ? 'is-sorted' : '',
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <th
        key={column.key}
        className={className}
        aria-sort={sorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        {sortable ? (
          <button
            type="button"
            className="header-sort-button"
            onClick={() => toggleSort(column)}
            title={`${column.label}を${sorted && sortConfig.direction === 'asc' ? '降順' : '昇順'}に並び替え`}
          >
            <span className="header-label">{column.label}</span>
            <span className="sort-indicator" aria-label={sortLabel}>
              {sorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
            </span>
          </button>
        ) : (
          <span className="header-label">{column.label}</span>
        )}
        <button
          type="button"
          className="column-resizer"
          onMouseDown={(event) => startColumnResize(column, event)}
          aria-label={`${column.label}の列幅を調整`}
          title="ドラッグで列幅調整"
        />
      </th>
    )
  }

  const tableWidth = currentColumnSpecs.reduce((sum, column) => sum + getColumnWidth(column), 0)
  const tableStyle = {
    '--image-column-width': `${getColumnWidth(currentColumnSpecs[0])}px`,
    '--products-table-width': `${tableWidth}px`,
  } as CSSProperties

  function renderNeInfoColumns(product: Product) {
    return (
      <>
        <td><DisplayText value={formatNumericValue(product.free_stock)} className="mono-text number-text" /></td>
        <td><DisplayText value={formatNumericValue(product.reorder_point)} className="mono-text number-text" /></td>
        <td><DisplayText value={formatNumericValue(product.stock_constant)} className="mono-text number-text" /></td>
        <td><MonthlySalesByYear monthlySales={getProductMonthlySales(product)} /></td>
        <td><DisplayText value={formatClassification(product.orderboard_classification)} className="classification-text" /></td>
      </>
    )
  }

  function renderNeColumns(product: Product) {
    return (
      <>
        <td><DisplayText value={product.product_name} className="product-name-text" /></td>
        {renderNeInfoColumns(product)}
      </>
    )
  }

  function renderAllColumns(product: Product, draft: EditableProduct) {
    return (
      <>
        <td>{renderTextCell(product, draft, 'product_name', { className: 'product-name-text', inputClassName: 'product-name-input' })}</td>
        {renderNeInfoColumns(product)}
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
        {renderNeInfoColumns(product)}
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

  const tableColSpan = currentColumnSpecs.length
  const tableClassName = `products-table products-table--${tableView}`

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card login-card--simple">
          <img src={`${import.meta.env.BASE_URL}login-logo.png`} alt="Shohin DB" className="login-logo" />

          <div className="form-stack login-form-stack">
            <label>
              {authQuestion}
              <input
                type="password"
                value={secretAnswer}
                onChange={(e) => setSecretAnswer(e.target.value)}
                placeholder="回答を入力"
                autoComplete="current-password"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') login()
                }}
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
          <button
            type="button"
            className="topbar-ne-button"
            onClick={() => setIsNeSyncPanelOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isNeSyncPanelOpen}
          >
            <span className="ne-button-logo-badge" aria-hidden="true">
              <img src={`${import.meta.env.BASE_URL}ne-logo.png`} alt="" />
            </span>
            <span>NE取得</span>
          </button>
          <span>{user.email}</span>
          <button className="secondary" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      <section className="toolbar">
        <div className="search-box">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="商品コード・商品名・特記事項・ピック時アドバイス・棚番号で検索"
          />
          <button
            type="button"
            className="search-clear-button"
            onClick={() => {
              setKeyword('')
              setDebouncedKeyword('')
            }}
            disabled={!keyword}
          >
            クリア
          </button>
        </div>

        <button className="utility-button" onClick={fetchProducts} disabled={loading || Boolean(savingCode)}>
          再読み込み
        </button>

        <button className="secondary utility-button" onClick={openImageImportModal}>画像インポート</button>

        <button className="primary-action-button" onClick={openCreateModal}>商品追加/更新</button>
      </section>

      {isNeSyncPanelOpen && (
        <div
          className="ne-sync-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsNeSyncPanelOpen(false)
            }
          }}
        >
          <aside className="ne-sync-modal" role="dialog" aria-modal="true" aria-label="NE取得">
            <div className="ne-sync-modal-header">
              <div>
                <strong>NE取得</strong>
                <span>取得項目・対象年月を選んでNEからSupabaseへ反映</span>
              </div>
              <button type="button" className="secondary small" onClick={() => setIsNeSyncPanelOpen(false)}>
                閉じる
              </button>
            </div>

            <div className="ne-sync-modal-body">
              <div className="ne-sync-auth-note ne-sync-auth-note--modal">
                Supabase Authのログイン状態でNE取得します。ADMIN_TOKENの入力は不要です。
              </div>

              <div className="ne-sync-actions ne-sync-actions--modal">
                <button type="button" className="secondary small" onClick={fetchNeUsage} disabled={neSyncLoading}>
                  利用回数
                </button>
                <button type="button" className="secondary small" onClick={() => syncNeOperationalFields(true)} disabled={neSyncLoading}>
                  dry-run
                </button>
                <button
                  type="button"
                  className="small ne-sync-primary-button"
                  onClick={() => syncNeOperationalFields(false)}
                  disabled={neSyncLoading}
                >
                  <span className="ne-button-logo-badge ne-button-logo-badge--small" aria-hidden="true">
                    <img src={`${import.meta.env.BASE_URL}ne-logo.png`} alt="" />
                  </span>
                  <span>NE取得</span>
                </button>
              </div>

              {(neSyncMessage || neUsage || neSyncResult || neMonthlyResult) && (
                <div className="ne-sync-status ne-sync-status--modal">
                  {neSyncMessage && <strong>{neSyncMessage}</strong>}
                  {neUsage && (
                    <span>利用：{neUsage.callCount ?? 0}回 / 残り{neUsage.remainingCalls ?? '-'}回 / {neUsage.estimatedGb ?? 0}GB</span>
                  )}
                  {neSyncResult && (
                    <span>NE情報：在庫{neSyncResult.stockFetched ?? 0}件・商品{neSyncResult.goodsFetched ?? 0}件 / 一致{neSyncResult.matched ?? 0}件 / 更新{neSyncResult.updated ?? 0}件</span>
                  )}
                  {neMonthlyResult && (
                    <span>月別受注数：{neMonthlyResult.months?.join('・') || '-'} / 明細{neMonthlyResult.rowFetched ?? 0}行 / 一致{neMonthlyResult.matched ?? 0}件 / 更新{neMonthlyResult.updated ?? 0}件</span>
                  )}
                </div>
              )}

              <div className="ne-sync-detail-grid">
                <div className="ne-sync-field-box">
                  <strong>取得項目</strong>
                  <div className="ne-sync-checks">
                    <label>
                      <input
                        type="checkbox"
                        checked={neSyncFields.freeStock}
                        onChange={(event) => updateNeSyncField('freeStock', event.target.checked)}
                      />
                      フリー在庫
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={neSyncFields.reorderPoint}
                        onChange={(event) => updateNeSyncField('reorderPoint', event.target.checked)}
                      />
                      発注点
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={neSyncFields.stockConstant}
                        onChange={(event) => updateNeSyncField('stockConstant', event.target.checked)}
                      />
                      在庫定数
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={neSyncFields.monthlySales}
                        onChange={(event) => updateNeSyncField('monthlySales', event.target.checked)}
                      />
                      月別受注数
                    </label>
                  </div>
                </div>

                {neSyncFields.monthlySales && (
                  <div className="ne-sync-month-box">
                    <div className="ne-sync-month-toolbar">
                      <strong>月別受注数の対象年月</strong>
                      <button type="button" className="secondary small" onClick={() => selectRecentNeMonths(1)} disabled={neSyncLoading}>
                        今月
                      </button>
                      <button type="button" className="secondary small" onClick={() => selectRecentNeMonths(3)} disabled={neSyncLoading}>
                        直近3か月
                      </button>
                      <button type="button" className="secondary small" onClick={() => selectRecentNeMonths(12)} disabled={neSyncLoading}>
                        直近12か月
                      </button>
                      <button type="button" className="secondary small" onClick={() => setSelectedNeMonths([])} disabled={neSyncLoading}>
                        クリア
                      </button>
                    </div>

                    <div className="ne-sync-month-groups">
                      {neMonthGroups.map((group) => (
                        <div key={group.year} className="ne-sync-month-group">
                          <span>{group.year}</span>
                          {group.months.map((key) => {
                            const month = key.slice(5, 7)
                            return (
                              <label key={key}>
                                <input
                                  type="checkbox"
                                  checked={selectedNeMonths.includes(key)}
                                  onChange={(event) => toggleNeSyncMonth(key, event.target.checked)}
                                />
                                {month}月
                              </label>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {message && (
        <div className="toast-message" role="status" aria-live="polite">
          {message}
        </div>
      )}

      <section className="layout layout--full">
        <div className="table-card">
          <div className="table-header">
            <div className="table-title">
              <strong>商品一覧</strong>
            </div>

            <div className="view-switch" aria-label="表示用途切り替え">
              <ViewButton active={tableView === 'order'} onClick={() => setTableView('order')}>
                オーダー状況
              </ViewButton>
              <ViewButton active={tableView === 'purchase'} onClick={() => setTableView('purchase')}>
                オーダー用
              </ViewButton>
              <ViewButton active={tableView === 'ne'} onClick={() => setTableView('ne')}>
                NE情報
              </ViewButton>
              <ViewButton active={tableView === 'pick'} onClick={() => setTableView('pick')}>
                紙出し用
              </ViewButton>
              <ViewButton active={tableView === 'custom'} onClick={() => setTableView('custom')}>
                カスタム
              </ViewButton>
              <ViewButton active={tableView === 'all'} onClick={() => setTableView('all')}>
                すべて
              </ViewButton>
            </div>

            <div className="table-pager" aria-label="商品一覧ページ送り">
              <button
                type="button"
                className="pager-button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPageNumber <= 1}
              >
                最初
              </button>
              <button
                type="button"
                className="pager-button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPageNumber <= 1}
              >
                前へ
              </button>
              <span className="pager-status">
                {currentPageNumber} / {totalPages}
              </span>
              <button
                type="button"
                className="pager-button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPageNumber >= totalPages}
              >
                次へ
              </button>
              <button
                type="button"
                className="pager-button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPageNumber >= totalPages}
              >
                最後
              </button>
              <span className="pager-range">
                {pagerRangeText}
              </span>
            </div>

            <div className="table-actions">
              <button
                type="button"
                className="small edit-button bulk-edit-button"
                onClick={startBulkEdit}
                disabled={products.length === 0 || Boolean(savingCode)}
              >
                一括編集
              </button>
              <button
                type="button"
                className="small save-button save-all-button"
                onClick={saveAllEdits}
                disabled={editingCodes.size === 0 || Boolean(savingCode)}
              >
                {savingCode === '__bulk_save__' ? '保存中' : 'すべて保存'}
              </button>
              <button
                type="button"
                className="secondary small cancel-button cancel-all-button"
                onClick={cancelAllEdits}
                disabled={editingCodes.size === 0 || Boolean(savingCode)}
              >
                すべてキャンセル
              </button>
            </div>

          </div>

          <div className="table-wrap">
            <table className={tableClassName} style={tableStyle}>
              <colgroup>
                {currentColumnSpecs.map((column) => (
                  <col key={column.key} style={{ width: `${getColumnWidth(column)}px` }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {currentColumnSpecs.map((column) => renderColumnHeader(column))}
                </tr>
              </thead>

              <tbody>
                {pagedProducts.map((product) => {
                  const draft = rowDrafts[product.product_code] ?? productToDraft(product)
                  const isEditing = editingCodes.has(product.product_code)
                  const dirty = isEditing && hasRowChanges(product, draft)

                  return (
                    <tr
                      key={product.product_code}
                      className={`${isEditing ? 'is-editing' : ''} ${dirty ? 'is-dirty' : ''}`}
                      onDoubleClick={(event) => handleRowDoubleClick(product, event)}
                    >
                      <td className="image-cell sticky-image-cell">
                        <ProductImageCell
                          product={product}
                          version={imageCacheVersion}
                          isEditing={isEditing}
                          draftImage={imageDrafts[product.product_code]}
                          onPreview={setImagePreview}
                          onImageFilesDrop={setRowImageDraft}
                        />
                      </td>

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
                      {tableView === 'ne' && renderNeColumns(product)}
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


      {isImageImportModalOpen && (
        <div className="modal-backdrop" onClick={closeImageImportModal}>
          <section
            className="modal-card image-import-modal"
            role="dialog"
            aria-modal="true"
            aria-label="商品画像インポート"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Product Images</p>
                <h2>商品画像インポート</h2>
              </div>

              <button className="secondary small" onClick={closeImageImportModal} disabled={imageImporting}>
                閉じる
              </button>
            </div>

            <div className="modal-body">
              <div
                className={isImageDragOver ? 'image-import-drop is-drag-over' : 'image-import-drop'}
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
                onDrop={handleImageDrop}
              >
                <div>
                  <strong>商品コード付き画像をまとめて取り込み</strong>
                  <span>ファイル名から商品コードを判定し、jpg / png / webp をWebPへ変換して product-images に上書きアップロードします。</span>
                </div>

                <label className="csv-upload-button">
                  画像を選択
                  <input
                    type="file"
                    accept={PRODUCT_IMAGE_ACCEPT}
                    multiple
                    onChange={handleImageFileSelect}
                  />
                </label>
              </div>

              <div className="image-import-summary">
                <span>選択中：{imageFiles.length}件</span>
                <span>保存先：{PRODUCT_IMAGE_BUCKET}</span>
                <span>保存形式：商品コード.webp</span>
              </div>

              {imageImportMessage && <p className="modal-message">{imageImportMessage}</p>}

              <div className="modal-actions">
                <button className="save-button" onClick={uploadProductImages} disabled={imageImporting || imageFiles.length === 0}>
                  {imageImporting ? 'アップロード中...' : `${imageFiles.length}件をアップロード`}
                </button>

                <button className="secondary" onClick={closeImageImportModal} disabled={imageImporting}>
                  キャンセル
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {imagePreview && (
        <div className="modal-backdrop" onClick={() => setImagePreview(null)}>
          <section
            className="image-preview-card"
            role="dialog"
            aria-modal="true"
            aria-label="商品画像プレビュー"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="image-preview-head">
              <div>
                <strong>{imagePreview.productCode}</strong>
                <span>{imagePreview.productName || '商品名なし'}</span>
              </div>

              <button className="secondary small" onClick={() => setImagePreview(null)}>
                閉じる
              </button>
            </div>

            <img src={imagePreview.url} alt={imagePreview.productName || imagePreview.productCode} />
          </section>
        </div>
      )}

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
                    <button type="button" className="save-button" onClick={applyManualCsvMapping}>
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

                  <button className="secondary small danger-button" onClick={clearBulkRows}>
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
                      <th>画像</th>
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

                        <td className="bulk-image-cell">
                          <div
                            className={
                              bulkImageDrafts[row.id]
                                ? 'bulk-image-drop is-pending'
                                : 'bulk-image-drop'
                            }
                            onDragOver={handleBulkImageDragOver}
                            onDrop={(event) => handleBulkImageDrop(event, row.id)}
                            title="ここに画像をドロップすると、この行の商品コード.webpとして保存します"
                          >
                            {bulkImageDrafts[row.id] ? (
                              <img
                                src={bulkImageDrafts[row.id].previewUrl}
                                alt={row.product_code || '追加予定画像'}
                              />
                            ) : (
                              <span>画像<br />Drop</span>
                            )}

                            <label className="bulk-image-upload-button">
                              選択
                              <input
                                type="file"
                                accept={PRODUCT_IMAGE_ACCEPT}
                                onChange={(event) => handleBulkImageFileSelect(event, row.id)}
                              />
                            </label>

                            {bulkImageDrafts[row.id] && (
                              <button
                                type="button"
                                className="bulk-image-remove-button"
                                onClick={() => clearBulkImageDrafts([row.id])}
                                aria-label="画像を削除"
                              >
                                ×
                              </button>
                            )}
                          </div>
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
                            className="secondary small danger-button"
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
                <span>画像待ち：{bulkImageDraftCount}件</span>
                {bulkSummary.duplicateCodes.length > 0 && (
                  <span>入力内重複：{bulkSummary.duplicateCodes.length}件</span>
                )}
              </div>

              {modalMessage && <p className="modal-message">{modalMessage}</p>}

              <div className="modal-actions">
                <button
                  className="save-button"
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
