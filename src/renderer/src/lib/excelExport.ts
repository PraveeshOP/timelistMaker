import ExcelJS from 'exceljs'
import type { GeneratedTimelist } from '@shared/domain'
import { isNorwegianHoliday, isWeekend } from '@shared/holidays'

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

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)
const FIRST_DATA_ROW = 4
const LAST_DATA_ROW = 34 // day 31 -> row 34 at the latest
const EXTRA_DATA_ROW = 35 // green-themed tables' sum range/always-fill extends one row further
const TOTALS_ROW = 36
const GRAND_TOTAL_ROW = 38
const COLS_PER_TABLE = 4 // Start, Stopp, Antall timer, Kundenavn
const NAME_COLUMN = 1 // column A

function excelSerialDate(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - EXCEL_EPOCH_UTC_MS) / 86400000)
}

function timeFraction(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h * 60 + m) / 1440
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function argb(hex: string): string {
  return `FF${hex}`
}

/** Converts a 1-based column number to its Excel letter(s), e.g. 1 -> A, 27 -> AA. */
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
  /** Mirrors the original template's second (green) table: its totals formula sums
   *  one row further than the first table's (through row 35, not just row 34). This
   *  only affects the SUM range — it has no bearing on cell fill/banding. */
  extendedTotalsRange: boolean
  /** Only the original template's second table had a medium divider between the
   *  header and spacer rows — preserved here rather than invented for every table. */
  mediumHeaderDivider: boolean
}

const BLUE_THEME: ColumnTheme = {
  headerFill: COLOR.headerBlue,
  headerFontColor: COLOR.white,
  spacerFill: COLOR.spacerBlue,
  borderColor: COLOR.borderBlue,
  extendedTotalsRange: false,
  mediumHeaderDivider: false
}

const GREEN_THEME: ColumnTheme = {
  headerFill: null,
  headerFontColor: COLOR.black,
  spacerFill: COLOR.spacerGreen,
  borderColor: COLOR.borderGreen,
  extendedTotalsRange: true,
  mediumHeaderDivider: true
}

function themeForTableIndex(index: number): ColumnTheme {
  return index % 2 === 0 ? BLUE_THEME : GREEN_THEME
}

function border(colorArgb: string, style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Border> {
  return { style, color: { argb: colorArgb } }
}

interface DayEntry {
  startTime: string
  stopTime: string
  totalHours: number
}

function findDayEntry(
  table: GeneratedTimelist['tables'][number] | undefined,
  dateStr: string
): DayEntry | null {
  if (!table) return null
  const row = table.rows.find((r) => r.date === dateStr)
  if (!row || !row.startTime || !row.stopTime || !row.totalHours) return null
  return { startTime: row.startTime, stopTime: row.stopTime, totalHours: row.totalHours }
}

/** Builds the monthly timesheet layout: column A is the employee name, and every
 *  workplace gets its own 4-column group (Start/Stopp/Antall timer/Kundenavn), laid out
 *  side by side starting at column B, alternating the blue/green color theme from the
 *  original two-table template. One row per calendar day (row = day + 3); weekends and
 *  Norwegian public holidays are left entirely blank. */
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

  const totalColumns = NAME_COLUMN + Math.max(tables.length, 1) * COLS_PER_TABLE
  sheet.columns = Array.from({ length: totalColumns }, (_, i) => {
    if (i === 0) return { width: 22 }
    const posInGroup = (i - NAME_COLUMN - 1) % COLS_PER_TABLE
    return { width: [13, 13, 11, 24][posInGroup] }
  })

  const baseFont = (): Partial<ExcelJS.Font> => ({ name: 'Arial', size: 10, color: { argb: COLOR.black } })

  // Baseline Arial 10 black font across the whole used range.
  for (let r = 1; r <= GRAND_TOTAL_ROW; r++) {
    for (let c = 1; c <= totalColumns; c++) {
      sheet.getCell(r, c).font = baseFont()
    }
  }

  // Row 1 — "Ansatt" title above the name column.
  sheet.getCell(1, NAME_COLUMN).value = 'Ansatt'
  sheet.getCell(1, NAME_COLUMN).font = { ...baseFont(), bold: true }

  const kolonneLabels = ['Kolonne1', 'Kolonne2', 'Kolonne3', 'Kolonne5']
  const fieldLabels = ['Start', 'Stopp', 'Antall timer', 'Kundenavn']

  const tableCount = Math.max(tables.length, 1)
  const tableColumns: { startCol: number; stopCol: number; hoursCol: number; custCol: number; theme: ColumnTheme }[] =
    []

  for (let i = 0; i < tableCount; i++) {
    const startCol = NAME_COLUMN + 1 + i * COLS_PER_TABLE
    const theme = themeForTableIndex(i)
    const cols = { startCol, stopCol: startCol + 1, hoursCol: startCol + 2, custCol: startCol + 3, theme }
    tableColumns.push(cols)

    // Row 1 — table header labels
    ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col, labelIdx) => {
      const cell = sheet.getCell(1, col)
      cell.value = kolonneLabels[labelIdx]
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: theme.headerFontColor } }
      if (theme.headerFill) cell.fill = solidFill(theme.headerFill)
    })

    // Row 2 — spacer fill
    ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
      sheet.getCell(2, col).fill = solidFill(theme.spacerFill)
    })

    // Row 3 — field labels. The original template's second table had a trailing
    // space on its hours label ("Antall timer ") — preserved for that exact table only.
    fieldLabels.forEach((label, labelIdx) => {
      const col = [cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol][labelIdx]
      const isLegacyHoursQuirk = i === 1 && labelIdx === 2
      sheet.getCell(3, col).value = isLegacyHoursQuirk ? `${label} ` : label
    })
  }

  const totalDays = daysInMonth(month, year)
  const DATE_NUM_FMT = 'm/d/yy h:mm'

  for (let day = 1; day <= totalDays; day++) {
    const row = day + 3
    const dateStr = isoDate(year, month, day)
    const dateObj = new Date(`${dateStr}T00:00:00`)

    if (isWeekend(dateObj) || isNorwegianHoliday(dateObj)) continue // entire row left blank

    sheet.getCell(row, NAME_COLUMN).value = employeeFullName

    const serial = excelSerialDate(year, month, day)

    tables.forEach((table, i) => {
      const cols = tableColumns[i]
      // The workplace name identifies the column group on every working day, regardless
      // of whether hours happen to be logged that day (otherwise a workplace with no
      // entries yet — e.g. one just added — would render as an unlabeled blank section).
      sheet.getCell(row, cols.custCol).value = table.workplace.name
      const entry = findDayEntry(table, dateStr)
      if (!entry) return
      sheet.getCell(row, cols.startCol).value = serial + timeFraction(entry.startTime)
      sheet.getCell(row, cols.stopCol).value = serial + timeFraction(entry.stopTime)
      sheet.getCell(row, cols.hoursCol).value = entry.totalHours
    })
  }

  // Number formats: start/stop columns as datetimes, hours columns as plain numbers.
  for (let r = FIRST_DATA_ROW; r <= TOTALS_ROW; r++) {
    for (const cols of tableColumns) {
      sheet.getCell(r, cols.startCol).numFmt = DATE_NUM_FMT
      sheet.getCell(r, cols.stopCol).numFmt = DATE_NUM_FMT
      sheet.getCell(r, cols.hoursCol).numFmt = 'General'
    }
  }

  // Totals — one per table, in its own "Stopp"/"Antall timer" column pair.
  const totalFormulaAddresses: string[] = []
  tableColumns.forEach((cols) => {
    const sumEnd = cols.theme.extendedTotalsRange ? EXTRA_DATA_ROW : LAST_DATA_ROW
    const hoursColLetter = columnLetter(cols.hoursCol)
    sheet.getCell(TOTALS_ROW, cols.stopCol).value = 'Total'
    const hoursTotalCell = sheet.getCell(TOTALS_ROW, cols.hoursCol)
    hoursTotalCell.value = { formula: `SUM(${hoursColLetter}${FIRST_DATA_ROW}:${hoursColLetter}${sumEnd})` }
    totalFormulaAddresses.push(hoursTotalCell.address)
  })

  sheet.getCell(GRAND_TOTAL_ROW, NAME_COLUMN).value = 'Total'
  sheet.getCell(GRAND_TOTAL_ROW, NAME_COLUMN).font = { ...baseFont(), bold: true }
  const grandTotalCell = sheet.getCell(GRAND_TOTAL_ROW, tableColumns[0].custCol)
  grandTotalCell.value = { formula: totalFormulaAddresses.join('+') }
  grandTotalCell.font = { ...baseFont(), bold: true }

  // Banded shading, rows 4-36 (even rows shaded, odd rows plain).
  for (let r = FIRST_DATA_ROW; r <= TOTALS_ROW; r++) {
    if (r % 2 !== 0) continue
    tableColumns.forEach((cols) => {
      ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
        sheet.getCell(r, col).fill = solidFill(cols.theme.spacerFill)
      })
    })
  }
  // Borders — each table's own thin border on all sides, rows 1-36.
  for (let r = 1; r <= TOTALS_ROW; r++) {
    tableColumns.forEach((cols) => {
      const b = border(cols.theme.borderColor)
      ;[cols.startCol, cols.stopCol, cols.hoursCol, cols.custCol].forEach((col) => {
        sheet.getCell(r, col).border = { top: b, left: b, bottom: b, right: b }
      })
    })
    sheet.getCell(r, NAME_COLUMN).border = { right: border(tableColumns[0].theme.borderColor) }
  }

  // Each table's last column right edge is colored to match the next table's theme,
  // visually separating adjacent tables (mirrors the original blue-table/green-table seam).
  for (let i = 0; i < tableColumns.length - 1; i++) {
    const cols = tableColumns[i]
    const nextTheme = tableColumns[i + 1].theme
    for (let r = 1; r <= TOTALS_ROW; r++) {
      const cell = sheet.getCell(r, cols.custCol)
      cell.border = { ...cell.border, right: border(nextTheme.borderColor) }
    }
  }

  // Header/spacer divider — only the original template's green-style tables get a
  // medium-weight rule between the header and spacer rows.
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
