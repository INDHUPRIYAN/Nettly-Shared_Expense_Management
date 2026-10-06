import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { APP_NAME } from '@/config/app'
import { getCategory } from '@/lib/categories'
import { formatMoney, type MemberBalance, type Money, type Transfer, type UserId } from '@/lib/settlement'
import type { Expense, Group, Member, Settlement } from '@/types/app'

/*
 * PDF receipts and reports, generated entirely in the browser.
 * The standard PDF fonts cannot draw "₹", so rupee amounts are written "Rs.".
 */

export interface PdfContext {
  group: Group
  members: Member[]
  nameOf: (userId: UserId | null | undefined) => string
}

export interface ReportData extends PdfContext {
  expenses: Expense[]
  settlements: Settlement[]
  balances: MemberBalance[]
  transfers: Transfer[]
  totalSpent: Money
}

const BRAND: [number, number, number] = [225, 29, 72]
const INK: [number, number, number] = [55, 30, 35]
const MUTED: [number, number, number] = [120, 100, 105]
const MARGIN = 16

const SPLIT_LABEL = { equal: 'Split equally', custom: 'Custom amounts', percentage: 'By percentage', shares: 'By shares' } as const
const STATUS_LABEL = { paid: 'Paid (confirmed by receiver)', pending: 'Waiting for receiver to confirm', cancelled: 'Cancelled' } as const

export function pdfMoney(amount: Money, currency: string): string {
  return formatMoney(amount, currency, { trimZeroDecimals: false }).replace('₹', 'Rs. ')
}

const longDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const longDateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const fmtDate = (iso: string) => longDate.format(new Date(iso))

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'receipt'
}

function header(doc: jsPDF, kind: string, ctx: PdfContext, reference?: string) {
  const width = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, width, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(APP_NAME, MARGIN, 19)
  doc.setFontSize(11)
  doc.text(kind.toUpperCase(), width - MARGIN, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (reference) doc.text(`No. ${reference}`, width - MARGIN, 21, { align: 'right' })

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(ctx.group.name, MARGIN, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`Generated ${longDateTime.format(new Date())}  ·  Currency ${ctx.group.currency}`, MARGIN, 50)
  return 60
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(240, 200, 205)
    doc.line(MARGIN, height - 14, width - MARGIN, height - 14)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`${APP_NAME} — Split anything. Settle everything.`, MARGIN, height - 8)
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 8, { align: 'right' })
  }
}

/** Two-column "label: value" block. Returns the next y position. */
function details(doc: jsPDF, y: number, rows: Array<[string, string]>) {
  const width = doc.internal.pageSize.getWidth()
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 1.6, bottom: 1.6, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { cellWidth: 42, textColor: MUTED }, 1: { cellWidth: width - MARGIN * 2 - 42, fontStyle: 'bold' } },
  })
  return lastY(doc) + 6
}

function sectionTitle(doc: jsPDF, y: number, title: string) {
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage()
    y = 20
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND)
  doc.text(title, MARGIN, y)
  doc.setTextColor(...INK)
  return y + 3
}

function table(doc: jsPDF, y: number, head: string[], body: string[][], foot?: string[], rightAlign: number[] = []) {
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    head: [head],
    body,
    foot: foot ? [foot] : undefined,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.2, textColor: INK, lineColor: [240, 210, 215], lineWidth: 0.2 },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [255, 241, 242], textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 248, 248] },
    columnStyles: Object.fromEntries(rightAlign.map((i) => [i, { halign: 'right' as const }])),
    // columnStyles only apply to body cells; align money in the totals row too.
    didParseCell: (hook) => {
      if (hook.section === 'foot' && rightAlign.includes(hook.column.index)) hook.cell.styles.halign = 'right'
    },
  })
  return lastY(doc) + 8
}

function lastY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60
}

function weightLabel(expense: Expense, weight: number | null) {
  if (weight == null) return expense.splitType === 'equal' ? 'Equal' : 'Custom'
  if (expense.splitType === 'percentage') return `${weight}%`
  if (expense.splitType === 'shares') return `${weight} ${weight === 1 ? 'share' : 'shares'}`
  return '-'
}

/** Receipt for one expense, with every member's share. */
export function buildExpenseReceipt(ctx: PdfContext, expense: Expense): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const money = (v: Money) => pdfMoney(v, ctx.group.currency)
  let y = header(doc, 'Expense receipt', ctx, expense.id.slice(0, 8).toUpperCase())

  y = details(doc, y, [
    ['Expense', expense.title],
    ['Amount', money(expense.amount)],
    ['Date', fmtDate(expense.expenseDate)],
    ['Category', getCategory(expense.category).label],
    ['Paid by', ctx.nameOf(expense.paidBy)],
    ['Split method', SPLIT_LABEL[expense.splitType]],
    ['Added by', `${ctx.nameOf(expense.createdBy)} on ${fmtDate(expense.createdAt)}`],
    ...(expense.description ? ([['Description', expense.description]] as Array<[string, string]>) : []),
  ])

  y = sectionTitle(doc, y, 'Who owes what')
  const payerShare = expense.splits.find((s) => s.userId === expense.paidBy)?.amount ?? 0
  y = table(
    doc,
    y,
    ['Member', 'Share basis', 'Share', 'Owes to payer'],
    expense.splits.map((s) => [
      ctx.nameOf(s.userId),
      weightLabel(expense, s.weight),
      money(s.amount),
      s.userId === expense.paidBy ? '- (paid)' : money(s.amount),
    ]),
    ['Total', '', money(expense.amount), money(expense.amount - payerShare)],
    [2, 3],
  )

  const included = new Set(expense.splits.map((s) => s.userId))
  const excluded = ctx.members.filter((m) => m.isActive && !included.has(m.userId)).map((m) => m.name)
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  if (excluded.length) {
    doc.text(`Not included (owe nothing for this expense): ${excluded.join(', ')}`, MARGIN, y, { maxWidth: 178 })
    y += 6
  }
  doc.text(
    `${ctx.nameOf(expense.paidBy)} paid ${money(expense.amount)} and gets back ${money(expense.amount - payerShare)} from the others.`,
    MARGIN,
    y,
    { maxWidth: 178 },
  )
  footer(doc)
  return doc
}

/** Receipt for one payment between members. */
export function buildSettlementReceipt(ctx: PdfContext, settlement: Settlement): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = header(doc, 'Payment receipt', ctx, settlement.id.slice(0, 8).toUpperCase())
  y = details(doc, y, [
    ['From', ctx.nameOf(settlement.fromUser)],
    ['To', ctx.nameOf(settlement.toUser)],
    ['Amount', pdfMoney(settlement.amount, ctx.group.currency)],
    ['Status', STATUS_LABEL[settlement.status]],
    ...(settlement.paidAt ? ([['Paid on', longDateTime.format(new Date(settlement.paidAt))]] as Array<[string, string]>) : []),
    ...(settlement.cancelledAt
      ? ([['Cancelled on', longDateTime.format(new Date(settlement.cancelledAt))]] as Array<[string, string]>)
      : []),
    ['Recorded', `${longDateTime.format(new Date(settlement.createdAt))} by ${ctx.nameOf(settlement.createdBy)}`],
    ...(settlement.note ? ([['Note', settlement.note]] as Array<[string, string]>) : []),
  ])
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(
    settlement.status === 'paid'
      ? `${ctx.nameOf(settlement.toUser)} confirmed receiving this payment. Original expenses are not changed by payments.`
      : 'This payment does not count towards balances unless it is confirmed by the receiver.',
    MARGIN,
    y,
    { maxWidth: 178 },
  )
  footer(doc)
  return doc
}

/** Full group report: summary, member-wise totals, pending payments, all expenses and payments. */
export function buildGroupReport(data: ReportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const money = (v: Money) => pdfMoney(v, data.group.currency)
  let y = header(doc, 'Group report', data)
  const active = data.members.filter((m) => m.isActive)

  y = details(doc, y, [
    ['Total spent', money(data.totalSpent)],
    ['Members', `${active.length} (${active.map((m) => m.name).join(', ')})`],
    ['Expenses', String(data.expenses.length)],
    ['Payments', String(data.settlements.filter((s) => s.status === 'paid').length) + ' confirmed'],
  ])

  y = sectionTitle(doc, y, 'Member-wise totals')
  const rows = data.balances.filter((b) => b.paid || b.share || b.net || active.some((m) => m.userId === b.userId))
  y = table(
    doc,
    y,
    ['Member', 'Paid', 'Share', 'Settled', 'Received', 'Balance'],
    rows.map((b) => [
      data.nameOf(b.userId),
      money(b.paid),
      money(b.share),
      money(b.sent),
      money(b.received),
      b.net === 0 ? 'Settled' : `${b.net > 0 ? '+' : ''}${money(b.net)} ${b.net > 0 ? '(gets back)' : '(owes)'}`,
    ]),
    ['Total', money(rows.reduce((s, b) => s + b.paid, 0)), money(rows.reduce((s, b) => s + b.share, 0)), '', '', 'Balanced'],
    [1, 2, 3, 4, 5],
  )

  y = sectionTitle(doc, y, 'Pending payments (fewest needed to settle up)')
  if (data.transfers.length) {
    y = table(
      doc,
      y,
      ['From', 'To', 'Amount'],
      data.transfers.map((t) => [data.nameOf(t.from), data.nameOf(t.to), money(t.amount)]),
      undefined,
      [2],
    )
  } else {
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text('Everyone is settled up.', MARGIN, y + 4)
    y += 12
  }

  y = sectionTitle(doc, y, 'Expenses')
  y = table(
    doc,
    y,
    ['Date', 'Expense', 'Category', 'Paid by', 'Split', 'Amount'],
    data.expenses.map((e) => [
      fmtDate(e.expenseDate),
      e.title,
      getCategory(e.category).label,
      data.nameOf(e.paidBy),
      `${SPLIT_LABEL[e.splitType]} (${e.splits.length})`,
      money(e.amount),
    ]),
    ['', '', '', '', 'Total', money(data.totalSpent)],
    [5],
  )

  const history = data.settlements.filter((s) => s.status !== 'pending')
  if (history.length) {
    y = sectionTitle(doc, y, 'Payment history')
    table(
      doc,
      y,
      ['Date', 'From', 'To', 'Status', 'Amount'],
      history.map((s) => [
        fmtDate(s.paidAt ?? s.createdAt),
        data.nameOf(s.fromUser),
        data.nameOf(s.toUser),
        s.status === 'paid' ? 'Paid' : 'Cancelled',
        money(s.amount),
      ]),
      undefined,
      [4],
    )
  }
  footer(doc)
  return doc
}

export function expenseReceiptFilename(group: Group, expense: Expense) {
  return `${slug(group.name)}-${slug(expense.title)}-receipt.pdf`
}
export function settlementReceiptFilename(group: Group, settlement: Settlement, nameOf: PdfContext['nameOf']) {
  return `${slug(group.name)}-payment-${slug(nameOf(settlement.fromUser))}-to-${slug(nameOf(settlement.toUser))}.pdf`
}
export function groupReportFilename(group: Group) {
  return `${slug(group.name)}-report-${new Date().toISOString().slice(0, 10)}.pdf`
}
