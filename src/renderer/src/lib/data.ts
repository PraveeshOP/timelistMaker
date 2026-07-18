import { supabase } from './supabaseClient'
import type { TimeEntry, Timelist, TimelistRow, Workplace } from '@shared/domain'

interface WorkplaceRow {
  id: string
  user_id: string
  name: string
  created_at: string
}

function fromWorkplaceRow(row: WorkplaceRow): Workplace {
  return { id: row.id, userId: row.user_id, name: row.name, createdAt: row.created_at }
}

export async function fetchWorkplaces(userId: string): Promise<Workplace[]> {
  const { data, error } = await supabase
    .from('workplaces')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as WorkplaceRow[]).map(fromWorkplaceRow)
}

export async function createWorkplace(userId: string, name: string): Promise<Workplace> {
  const { data, error } = await supabase
    .from('workplaces')
    .insert({ user_id: userId, name })
    .select('*')
    .single()
  if (error) throw error
  return fromWorkplaceRow(data as WorkplaceRow)
}

export async function renameWorkplace(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('workplaces').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteWorkplace(id: string): Promise<void> {
  const { error } = await supabase.from('workplaces').delete().eq('id', id)
  if (error) throw error
}

interface TimelistRowDb {
  id: string
  user_id: string
  month: number
  year: number
  created_at: string
}

function fromTimelistRow(row: TimelistRowDb): Timelist {
  return { id: row.id, userId: row.user_id, month: row.month, year: row.year, createdAt: row.created_at }
}

export async function fetchTimelists(userId: string): Promise<Timelist[]> {
  const { data, error } = await supabase
    .from('timelists')
    .select('*')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return (data as TimelistRowDb[]).map(fromTimelistRow)
}

interface TimeEntryRowDb {
  id: string
  user_id: string
  workplace_id: string
  timelist_id: string
  date: string
  start_time: string | null
  stop_time: string | null
  total_hours: string | number
  is_weekend: boolean
  is_holiday: boolean
}

function fromTimeEntryRow(row: TimeEntryRowDb): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    workplaceId: row.workplace_id,
    timelistId: row.timelist_id,
    date: row.date,
    startTime: row.start_time,
    stopTime: row.stop_time,
    totalHours: Number(row.total_hours),
    isWeekend: row.is_weekend,
    isHoliday: row.is_holiday
  }
}

export async function fetchTimeEntriesForTimelist(timelistId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('timelist_id', timelistId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data as TimeEntryRowDb[]).map(fromTimeEntryRow)
}

/** Creates (or reuses) the `timelists` row for a given month/year, keyed by the unique
 *  (user_id, month, year) constraint. */
export async function upsertTimelist(userId: string, month: number, year: number): Promise<Timelist> {
  const { data, error } = await supabase
    .from('timelists')
    .upsert({ user_id: userId, month, year }, { onConflict: 'user_id,month,year' })
    .select('*')
    .single()
  if (error) throw error
  return fromTimelistRow(data as TimelistRowDb)
}

/** Persists every row of a generated timelist, keyed by the unique
 *  (timelist_id, workplace_id, date) constraint so re-saves overwrite in place. */
export async function saveTimelistRows(
  userId: string,
  timelistId: string,
  rows: TimelistRow[]
): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map((row) => ({
    user_id: userId,
    timelist_id: timelistId,
    workplace_id: row.workplaceId,
    date: row.date,
    start_time: row.startTime,
    stop_time: row.stopTime,
    total_hours: row.totalHours,
    is_weekend: row.isWeekend,
    is_holiday: row.isHoliday
  }))
  const { error } = await supabase
    .from('time_entries')
    .upsert(payload, { onConflict: 'timelist_id,workplace_id,date' })
  if (error) throw error
}
