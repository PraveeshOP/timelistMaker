export interface Workplace {
  id: string
  userId: string
  name: string
  createdAt: string
}

export interface TimeEntry {
  id: string
  userId: string
  workplaceId: string
  timelistId: string
  date: string // 'yyyy-MM-dd'
  startTime: string | null // 'HH:mm'
  stopTime: string | null // 'HH:mm'
  totalHours: number
  isWeekend: boolean
  isHoliday: boolean
}

export interface Timelist {
  id: string
  userId: string
  month: number // 1-12
  year: number
  createdAt: string
}

/** In-memory row shown in the editor grid, one per (workplace, date) pair. */
export interface TimelistRow {
  date: string // 'yyyy-MM-dd'
  workplaceId: string
  startTime: string | null
  stopTime: string | null
  totalHours: number
  isWeekend: boolean
  isHoliday: boolean
  holidayName: string | null
}

export interface WorkplaceTableData {
  workplace: Workplace
  rows: TimelistRow[]
  subtotalHours: number
}

export interface GeneratedTimelist {
  month: number
  year: number
  tables: WorkplaceTableData[]
  grandTotalHours: number
}
