// ラクマート発注レシピの備考テンプレート
//
//   {構成品名}        → その構成品の行番号（注文詳細の No）。複数行ならカンマ区切り  例：{ソックス} → 7,8,9
//   {構成品名:規格値} → その規格の1行だけの番号                                    例：{巾着:20*30} → 1
//   {数量}            → オーダー数（NEの単位）
//
// ●商品コード▲日付-数量 はテンプレートに書かず、末尾に自動で付ける（入庫一括の原価計算の目印）。
// 共有の付属品の行には、その行を使う全商品の「指示文＋●▲」を空行区切りで並べる。
// Playwright 側でも同じ関数を使うので、React などに依存しない純粋な関数だけを置く。

export type RakumartRemarkLine = {
  /** 注文詳細の No */
  no: number
  /** この明細の規格値（規格軸は含めない） */
  specs: string[]
}

export type RakumartRemarkItem = {
  itemName: string
  lines: RakumartRemarkLine[]
}

export type RakumartRemarkResult = {
  text: string
  /** テンプレートにあるが、構成品・規格が見つからない差し込み */
  unknown: string[]
}

const PLACEHOLDER = /\{([^{}]+)\}/g

function normalize(value: string) {
  return value.replace(/\s+/g, '').toLowerCase()
}

/**
 * {構成品名:規格値} に当たる明細を探す。
 *   1. 規格値の組み合わせがぴったり同じ明細（「サイズ/色」のように / でつないだ指定も可）
 *   2. なければ、指定した値をすべて含む明細が1つだけならそれ
 *   どちらでも1つに決まらなければ null（試し表示で「見つからない差し込み」になる）
 */
export function findRakumartRemarkLine(item: RakumartRemarkItem, spec: string): RakumartRemarkLine | null {
  const target = normalize(spec)
  if (!target) return null
  const exact = item.lines.filter((line) => {
    const values = line.specs.map(normalize)
    if (normalize(line.specs.join('/')) === target) return true
    if (values.length === 1 && values[0] === target) return true
    const parts = target.split('/').filter(Boolean)
    return parts.length === values.length && parts.every((part) => values.includes(part))
  })
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return null
  const parts = target.split('/').filter(Boolean)
  const partial = item.lines.filter((line) => {
    const values = line.specs.map(normalize)
    return values.includes(target) || (parts.length > 1 && parts.every((part) => values.includes(part)))
  })
  return partial.length === 1 ? partial[0] : null
}

export function renderRakumartRemarkTemplate(
  template: string,
  items: RakumartRemarkItem[],
  orderQuantity: number,
): RakumartRemarkResult {
  const unknown: string[] = []
  const byName = new Map(items.map((item) => [item.itemName.trim(), item]))

  const text = template.replace(PLACEHOLDER, (whole, rawKey: string) => {
    const key = rawKey.trim()
    if (key === '数量') return String(orderQuantity)

    const colon = key.search(/[:：]/)
    if (colon >= 0) {
      const item = byName.get(key.slice(0, colon).trim())
      const spec = key.slice(colon + 1).trim()
      const line = item ? findRakumartRemarkLine(item, spec) : null
      if (!line) {
        unknown.push(whole)
        return whole
      }
      return String(line.no)
    }

    const item = byName.get(key)
    if (!item || item.lines.length === 0) {
      unknown.push(whole)
      return whole
    }
    return [...item.lines]
      .map((line) => line.no)
      .sort((a, b) => a - b)
      .join(',')
  })

  return { text, unknown: [...new Set(unknown)] }
}

/** ●商品コード▲MMDD-数量（OrderBoard の buildOrderInstructionSuffix と同じ形式） */
export function buildRakumartOrderToken(productCode: string, mmdd: string, orderQuantity: number) {
  return `●${productCode.trim()}▲${mmdd}-${Math.max(0, Math.trunc(orderQuantity))}`
}

/** 1商品分の備考ブロック = 指示文 + 改行 + ●▲ */
export function buildRakumartRemarkBlock(instruction: string, token: string) {
  const body = instruction.trim()
  return body ? `${body}\n${token}` : token
}

/** 1行の備考 = その行を使う商品のブロックを空行区切りで並べる（共有の付属品の行） */
export function joinRakumartRemarkBlocks(blocks: string[]) {
  return [...new Set(blocks.map((block) => block.trim()).filter(Boolean))].join('\n\n')
}

/** 構成品名に使えない文字（差し込みの区切りと衝突する） */
export const RAKUMART_ITEM_NAME_FORBIDDEN = /[{}:：]/

/** テンプレートで使える差し込みの一覧（編集画面の案内用） */
export function listRakumartRemarkPlaceholders(items: RakumartRemarkItem[]) {
  const names: string[] = ['{数量}']
  for (const item of items) {
    const name = item.itemName.trim()
    if (!name) continue
    names.push(`{${name}}`)
    if (item.lines.length > 1) {
      // 全明細に共通する規格値（例：均码）は省き、明細を見分けられる値だけを使う。
      // その書き方で別の明細に当たってしまう場合は、全部の値をつないだ書き方にする
      const common = item.lines
        .map((line) => new Set(line.specs))
        .reduce((acc, set) => new Set([...acc].filter((value) => set.has(value))))
      for (const line of item.lines) {
        const distinct = line.specs.filter((value) => !common.has(value)).join('/')
        const full = line.specs.join('/')
        const spec = [distinct, full].find((candidate) => candidate && findRakumartRemarkLine(item, candidate) === line)
        if (spec) names.push(`{${name}:${spec}}`)
      }
    }
  }
  return [...new Set(names)]
}
