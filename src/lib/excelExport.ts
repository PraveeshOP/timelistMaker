import ExcelJS from 'exceljs'
import type { GeneratedTimelist, TimelistRow } from '@shared/domain'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const FIRST_DATA_ROW = 4
const MIN_TOTALS_ROW = 22
const COLS_PER_TABLE = 4
const NAME_COLUMN = 1

function argb(hex: string): string {
  return `FF${hex}`
}

function columnLetter(col: number): string {
  let letters = ''
  let n = col
  while (n > 0) {
    const remainder = (n - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

function dateFromRow(row: TimelistRow, time: string): Date {
  const [year, month, day] = row.date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0))
}

function workedRows(rows: TimelistRow[]): TimelistRow[] {
  return rows
    .filter((row) => row.startTime && row.stopTime && row.totalHours > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

const COLOR = {
  black: argb('000000'),
  white: argb('FFFFFF'),
  headerBlue: argb('4472C4'),
  spacerBlue: argb('D9E1F2'),
  spacerGreen: argb('E2EFDA'),
  borderBlue: argb('8EA9DB'),
  borderGreen: argb('70AD47')
}

function solidFill(colorArgb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb } }
}

interface ColumnTheme {
  headerFill: string | null
  headerFontColor: string
  spacerFill: string
  borderColor: string
  mediumHeaderDivider: boolean
}

const BLUE_THEME: ColumnTheme = {
  headerFill: COLOR.headerBlue,
  headerFontColor: COLOR.white,
  spacerFill: COLOR.spacerBlue,
  borderColor: COLOR.borderBlue,
  mediumHeaderDivider: false
}

const GREEN_THEME: ColumnTheme = {
  headerFill: null,
  headerFontColor: COLOR.black,
  spacerFill: COLOR.spacerGreen,
  borderColor: COLOR.borderGreen,
  mediumHeaderDivider: true
}

function themeForTableIndex(index: number): ColumnTheme {
  return index % 2 === 0 ? BLUE_THEME : GREEN_THEME
}

function border(colorArgb: string, style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Border> {
  return { style, color: { argb: colorArgb } }
}

function headerLabelsForTable(index: number): string[] {
  const base = ['Kolonne1', 'Kolonne2', 'Kolonne3', 'Kolonne5']
  if (index <= 1) return base
  const suffix = String(index)
  return base.map((label) => `${label}${suffix}`)
}

/** Builds the compact timesheet layout used by the provided example workbook:
 *  one 4-column workplace block per customer, only worked rows are listed, the
 *  work date lives inside the Start/Stopp datetime cells, and totals sit below
 *  the longest workplace block. */
export async function buildTimesheetWorkbook(
  generated: GeneratedTimelist,
  employeeFullName: string
): Promise<ArrayBuffer> {
  const { month, year, tables } = generated
  const sheetName = `${MONTH_NAMES[month - 1]} ${year}`

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }]
  })

  const tableCount = Math.max(tables.length, 1)
  const totalColumns = NAME_COLUMN + tableCount * COLS_PER_TABLE
  const rowsByTable = tables.map((table) => workedRows(table.rows))
  const maxWorkedRows = Math.max(0, ...rowsByTable.map((rows) => rows.length))
  const lastDataRow = Math.max(FIRST_DATA_ROW, FIRST_DATA_ROW + maxWorkedRows - 1)
  const totalsRow = Math.max(MIN_TOTALS_ROW, lastDataRow + 2)
  const grandTotalRow = totalsRow + 2

  sheet.columns = Array.from({ length: totalColumns }, (_, i) => {
    if (i === 0) return { width: 22 }
    const posInGroup = (i - NAME_COLUMN - 1) % COLS_PER_TABLE
    return { width: [13, 13, 11, 24][posInGroup] }
  })

  const baseFont = (): Partial<ExcelJS.Font> => ({ name: 'Arial', size: 10, color: { argb: COLOR.black } })

  for (let r = 1; r <= grandTotalRow; r++) {
    for (let c = 1; c <= totalColumns; c++) {
      sheet.getCell(r, c).font = baseFont()
    }
  }

  sheet.getCell(1, NAME_COLUMN).value = 'Ansatt'
  sheet.getCell(1, NAME_COLUMN).font = { ...baseFont(), bold: true }

  const fieldLabels = ['Start', 'Stopp', 'Antall timer', 'Kundenavn']
  const tableColumns: { startCol: number; stopCol: number; hoursCol: number; custCol: number; theme: ColumnTheme }[] =
    []

  for (let i = 0; i < tableCount; i++) {
    const startCol = NAME_COLUMN + 1 + i * COLS_PER_TABLE
    const theme = themeForTableIndex(i)
    const cols = { startCol, stopCol: startCol + 1, hoursCol: startCol + 2, custCol: startCol + 3, theme }
    tableColumns.push(cols)

    headerLabelsForTable(i).forEach((label, labelIdx) => {
      const col = [cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol][labelIdx]
      const cell = sheet.getCell(1, col)
      cell.value = label
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: theme.headerFontColor } }
      if (theme.headerFill) cell.fill = solidFill(theme.headerFill)
    })

    ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
      sheet.getCell(2, col).fill = solidFill(theme.spacerFill)
    })

    fieldLabels.forEach((label, labelIdx) => {
      const col = [cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol][labelIdx]
      sheet.getCell(3, col).value = i === 1 && labelIdx === 2 ? `${label} ` : label
    })
  }

  const DATE_NUM_FMT = 'm/d/yy h:mm'

  tables.forEach((table, tableIndex) => {
    const cols = tableColumns[tableIndex]
    const rows = rowsByTable[tableIndex]

    rows.forEach((row, rowIndex) => {
      const sheetRow = FIRST_DATA_ROW + rowIndex
      sheet.getCell(sheetRow, NAME_COLUMN).value = employeeFullName
      sheet.getCell(sheetRow, cols.startCol).value = dateFromRow(row, row.startTime!)
      sheet.getCell(sheetRow, cols.stopCol).value = dateFromRow(row, row.stopTime!)
      sheet.getCell(sheetRow, cols.hoursCol).value = {
        formula: `ROUND((${columnLetter(cols.stopCol)}${sheetRow}-${columnLetter(cols.startCol)}${sheetRow})*24,2)`,
        result: row.totalHours
      }
      sheet.getCell(sheetRow, cols.custCol).value = table.workplace.name
    })
  })

  for (let r = FIRST_DATA_ROW; r <= totalsRow; r++) {
    tableColumns.forEach((cols) => {
      sheet.getCell(r, cols.startCol).numFmt = DATE_NUM_FMT
      sheet.getCell(r, cols.stopCol).numFmt = DATE_NUM_FMT
      sheet.getCell(r, cols.hoursCol).numFmt = 'General'
    })
  }

  const totalFormulaAddresses: string[] = []
  tableColumns.forEach((cols, tableIndex) => {
    const tableLastRow = FIRST_DATA_ROW + Math.max(rowsByTable[tableIndex]?.length ?? 0, 1) - 1
    const hoursColLetter = columnLetter(cols.hoursCol)
    sheet.getCell(totalsRow, cols.stopCol).value = 'Total'
    const hoursTotalCell = sheet.getCell(totalsRow, cols.hoursCol)
    hoursTotalCell.value = { formula: `SUM(${hoursColLetter}${FIRST_DATA_ROW}:${hoursColLetter}${tableLastRow})` }
    totalFormulaAddresses.push(hoursTotalCell.address)
  })

  sheet.getCell(grandTotalRow, NAME_COLUMN).value = 'Total'
  sheet.getCell(grandTotalRow, NAME_COLUMN).font = { ...baseFont(), bold: true }
  const grandTotalCell = sheet.getCell(grandTotalRow, NAME_COLUMN + 1)
  grandTotalCell.value = { formula: totalFormulaAddresses.join('+') }
  grandTotalCell.font = { ...baseFont(), bold: true }

  for (let r = FIRST_DATA_ROW; r <= totalsRow; r++) {
    if (r % 2 !== 0) continue
    tableColumns.forEach((cols) => {
      ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
        sheet.getCell(r, col).fill = solidFill(cols.theme.spacerFill)
      })
    })
  }

  for (let r = 1; r <= totalsRow; r++) {
    tableColumns.forEach((cols) => {
      const b = border(cols.theme.borderColor)
      ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
        sheet.getCell(r, col).border = { top: b, left: b, bottom: b, right: b }
      })
    })
    sheet.getCell(r, NAME_COLUMN).border = { right: border(tableColumns[0].theme.borderColor) }
  }

  for (let i = 0; i < tableColumns.length - 1; i++) {
    const cols = tableColumns[i]
    const nextTheme = tableColumns[i + 1].theme
    for (let r = 1; r <= totalsRow; r++) {
      const cell = sheet.getCell(r, cols.custCol)
      cell.border = { ...cell.border, right: border(nextTheme.borderColor) }
    }
  }

  tableColumns
    .filter((cols) => cols.theme.mediumHeaderDivider)
    .forEach((cols) => {
      ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
        const headerCell = sheet.getCell(1, col)
        headerCell.border = { ...headerCell.border, bottom: border(cols.theme.borderColor, 'medium') }
        const spacerCell = sheet.getCell(2, col)
        spacerCell.border = { ...spacerCell.border, top: border(cols.theme.borderColor, 'medium') }
      })
    })

  return workbook.xlsx.writeBuffer()
}
