import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { GeneratedTimelist, Timelist, Workplace, WorkplaceTableData } from '@shared/domain'
import { getHolidayName, isWeekend as computeIsWeekend } from '@shared/holidays'
import {
  applyFirstWeekPattern,
  applyTimeEdit,
  generateFreshTimelist,
  generateTimelistFromTemplate,
  recalculateTotals
} from '@shared/timelistGenerator'
import {
  createWorkplace,
  deleteWorkplace,
  fetchTimeEntriesForTimelist,
  fetchTimelists,
  fetchWorkplaces,
  renameWorkplace,
  saveTimelistRows,
  upsertTimelist
} from '../lib/data'
import { parseTimesheetWorkbook } from '../lib/excelImport'
import { useAuth } from './AuthContext'

interface TimelistContextValue {
  workplaces: Workplace[]
  priorTimelists: Timelist[]
  generated: GeneratedTimelist | null
  currentTimelistId: string | null
  loading: boolean
  saving: boolean
  refreshWorkplaces: () => Promise<void>
  refreshPriorTimelists: () => Promise<void>
  addWorkplace: (name: string) => Promise<void>
  renameWorkplaceById: (id: string, name: string) => Promise<void>
  removeWorkplace: (id: string) => Promise<void>
  generateFresh: (month: number, year: number) => void
  generateFromTemplate: (templateTimelistId: string, month: number, year: number) => Promise<void>
  importFromExcelFile: (buffer: ArrayBuffer) => Promise<{ error?: string }>
  updateRowTime: (
    workplaceId: string,
    date: string,
    field: 'startTime' | 'stopTime',
    value: string
  ) => void
  updateRowTotalHours: (workplaceId: string, date: string, hours: number) => void
  updateRowDate: (workplaceId: string, oldDate: string, newDate: string) => void
  applyWeekPatternToMonth: (workplaceId: string) => void
  save: () => Promise<{ error?: string }>
}

const TimelistContext = createContext<TimelistContextValue | null>(null)

export function TimelistProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user } = useAuth()
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [priorTimelists, setPriorTimelists] = useState<Timelist[]>([])
  const [generated, setGenerated] = useState<GeneratedTimelist | null>(null)
  const [currentTimelistId, setCurrentTimelistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const refreshWorkplaces = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setWorkplaces(await fetchWorkplaces(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  const refreshPriorTimelists = useCallback(async () => {
    if (!user) return
    setPriorTimelists(await fetchTimelists(user.id))
  }, [user])

  const addWorkplace = useCallback(
    async (name: string) => {
      if (!user || !name.trim()) return
      const workplace = await createWorkplace(user.id, name.trim())
      setWorkplaces((prev) => [...prev, workplace])
      // If a timelist is already generated, append a blank table for the new
      // workplace immediately instead of requiring a full regeneration.
      setGenerated((prev) => {
        if (!prev) return prev
        const newTable = generateFreshTimelist(prev.month, prev.year, [workplace]).tables[0]
        return recalculateTotals({ ...prev, tables: [...prev.tables, newTable] })
      })
    },
    [user]
  )

  const renameWorkplaceById = useCallback(async (id: string, name: string) => {
    if (!name.trim()) return
    await renameWorkplace(id, name.trim())
    setWorkplaces((prev) => prev.map((w) => (w.id === id ? { ...w, name: name.trim() } : w)))
  }, [])

  const removeWorkplace = useCallback(async (id: string) => {
    await deleteWorkplace(id)
    setWorkplaces((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const generateFresh = useCallback(
    (month: number, year: number) => {
      setCurrentTimelistId(null)
      setGenerated(recalculateTotals(generateFreshTimelist(month, year, workplaces)))
    },
    [workplaces]
  )

  const generateFromTemplate = useCallback(
    async (templateTimelistId: string, month: number, year: number) => {
      setLoading(true)
      try {
        const templateEntries = await fetchTimeEntriesForTimelist(templateTimelistId)
        setCurrentTimelistId(null)
        setGenerated(
          recalculateTotals(generateTimelistFromTemplate(month, year, workplaces, templateEntries))
        )
      } finally {
        setLoading(false)
      }
    },
    [workplaces]
  )

  const importFromExcelFile = useCallback(
    async (buffer: ArrayBuffer): Promise<{ error?: string }> => {
      if (!user) return { error: 'Not signed in.' }

      const parsed = await parseTimesheetWorkbook(buffer)
      if (!parsed.ok) return { error: parsed.error }

      setLoading(true)
      try {
        const knownByName = new Map(workplaces.map((w) => [w.name.toLowerCase(), w]))
        const newlyCreated: Workplace[] = []
        const tables: WorkplaceTableData[] = []

        for (const parsedWorkplace of parsed.data.workplaces) {
          const key = parsedWorkplace.name.toLowerCase()
          let workplace = knownByName.get(key)
          if (!workplace) {
            workplace = await createWorkplace(user.id, parsedWorkplace.name)
            knownByName.set(key, workplace)
            newlyCreated.push(workplace)
          }
          const rows = parsedWorkplace.rows.map((row) => ({ ...row, workplaceId: workplace!.id }))
          tables.push({ workplace, rows, subtotalHours: 0 })
        }

        if (newlyCreated.length > 0) {
          setWorkplaces((prev) => [...prev, ...newlyCreated])
        }

        setCurrentTimelistId(null)
        setGenerated(
          recalculateTotals({
            month: parsed.data.month,
            year: parsed.data.year,
            tables,
            grandTotalHours: 0
          })
        )
        return {}
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      } finally {
        setLoading(false)
      }
    },
    [user, workplaces]
  )

  const updateRowTime = useCallback(
    (workplaceId: string, date: string, field: 'startTime' | 'stopTime', value: string) => {
      setGenerated((prev) => {
        if (!prev) return prev
        const tables = prev.tables.map((table) => {
          if (table.workplace.id !== workplaceId) return table
          const rows = table.rows.map((row) =>
            row.date === date ? applyTimeEdit(row, field, value || null) : row
          )
          return { ...table, rows }
        })
        return recalculateTotals({ ...prev, tables })
      })
    },
    []
  )

  const updateRowTotalHours = useCallback((workplaceId: string, date: string, hours: number) => {
    setGenerated((prev) => {
      if (!prev) return prev
      const tables = prev.tables.map((table) => {
        if (table.workplace.id !== workplaceId) return table
        const rows = table.rows.map((row) =>
          row.date === date ? { ...row, totalHours: Number.isFinite(hours) ? hours : 0 } : row
        )
        return { ...table, rows }
      })
      return recalculateTotals({ ...prev, tables })
    })
  }, [])

  const updateRowDate = useCallback((workplaceId: string, oldDate: string, newDate: string) => {
    setGenerated((prev) => {
      if (!prev) return prev
      const parsedDate = new Date(`${newDate}T00:00:00`)
      const tables = prev.tables.map((table) => {
        if (table.workplace.id !== workplaceId) return table
        const rows = table.rows.map((row) => {
          if (row.date !== oldDate) return row
          const holidayName = getHolidayName(parsedDate)
          return {
            ...row,
            date: newDate,
            isWeekend: computeIsWeekend(parsedDate),
            isHoliday: holidayName !== null,
            holidayName
          }
        })
        return { ...table, rows }
      })
      return recalculateTotals({ ...prev, tables })
    })
  }, [])

  const applyWeekPatternToMonth = useCallback((workplaceId: string) => {
    setGenerated((prev) => {
      if (!prev) return prev
      const tables = prev.tables.map((table) =>
        table.workplace.id === workplaceId ? applyFirstWeekPattern(table) : table
      )
      return recalculateTotals({ ...prev, tables })
    })
  }, [])

  const save = useCallback(async (): Promise<{ error?: string }> => {
    if (!user || !generated) return { error: 'Nothing to save.' }
    setSaving(true)
    try {
      const timelist = await upsertTimelist(user.id, generated.month, generated.year)
      setCurrentTimelistId(timelist.id)
      const allRows = generated.tables.flatMap((table) => table.rows)
      await saveTimelistRows(user.id, timelist.id, allRows)
      await refreshPriorTimelists()
      return {}
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    } finally {
      setSaving(false)
    }
  }, [user, generated, refreshPriorTimelists])

  const value = useMemo<TimelistContextValue>(
    () => ({
      workplaces,
      priorTimelists,
      generated,
      currentTimelistId,
      loading,
      saving,
      refreshWorkplaces,
      refreshPriorTimelists,
      addWorkplace,
      renameWorkplaceById,
      removeWorkplace,
      generateFresh,
      generateFromTemplate,
      importFromExcelFile,
      updateRowTime,
      updateRowTotalHours,
      updateRowDate,
      applyWeekPatternToMonth,
      save
    }),
    [
      workplaces,
      priorTimelists,
      generated,
      currentTimelistId,
      loading,
      saving,
      refreshWorkplaces,
      refreshPriorTimelists,
      addWorkplace,
      renameWorkplaceById,
      removeWorkplace,
      generateFresh,
      generateFromTemplate,
      importFromExcelFile,
      updateRowTime,
      updateRowTotalHours,
      updateRowDate,
      applyWeekPatternToMonth,
      save
    ]
  )

  return <TimelistContext.Provider value={value}>{children}</TimelistContext.Provider>
}

export function useTimelist(): TimelistContextValue {
  const ctx = useContext(TimelistContext)
  if (!ctx) throw new Error('useTimelist must be used within TimelistProvider')
  return ctx
}
