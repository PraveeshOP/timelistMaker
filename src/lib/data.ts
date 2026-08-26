import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebaseClient'
import type { TimeEntry, Timelist, TimelistRow, Workplace } from '@shared/domain'

// Everything lives under users/{uid}/... so Firestore security rules can scope an
// entire subtree with a single `request.auth.uid == uid` check (see firestore.rules) —
// no per-document owner field or RLS-style policy needed.
const usersCol = collection(db, 'users')
const workplacesCol = (uid: string) => collection(db, 'users', uid, 'workplaces')
const timelistsCol = (uid: string) => collection(db, 'users', uid, 'timelists')
const entriesCol = (uid: string, timelistId: string) =>
  collection(db, 'users', uid, 'timelists', timelistId, 'entries')

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export async function ensureUserDoc(uid: string, email: string, fullName: string): Promise<void> {
  await setDoc(doc(usersCol, uid), { email, fullName, createdAt: new Date().toISOString() })
}

export async function updateUserFullName(uid: string, fullName: string): Promise<void> {
  await updateDoc(doc(usersCol, uid), { fullName })
}

interface WorkplaceDoc {
  name: string
  createdAt: string
}

function fromWorkplaceDoc(uid: string, id: string, data: WorkplaceDoc): Workplace {
  return { id, userId: uid, name: data.name, createdAt: data.createdAt }
}

export async function fetchWorkplaces(uid: string): Promise<Workplace[]> {
  const snapshot = await getDocs(query(workplacesCol(uid), orderBy('createdAt', 'asc')))
  return snapshot.docs.map((d) => fromWorkplaceDoc(uid, d.id, d.data() as WorkplaceDoc))
}

export async function createWorkplace(uid: string, name: string): Promise<Workplace> {
  const data: WorkplaceDoc = { name, createdAt: new Date().toISOString() }
  const ref = await addDoc(workplacesCol(uid), data)
  return fromWorkplaceDoc(uid, ref.id, data)
}

export async function renameWorkplace(uid: string, id: string, name: string): Promise<void> {
  await updateDoc(doc(workplacesCol(uid), id), { name })
}

export async function deleteWorkplace(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(workplacesCol(uid), id))
}

interface TimelistDoc {
  month: number
  year: number
  createdAt: string
}

function fromTimelistDoc(uid: string, id: string, data: TimelistDoc): Timelist {
  return { id, userId: uid, month: data.month, year: data.year, createdAt: data.createdAt }
}

/** Fetches every timelist for the user, newest first. Sorted client-side (rather than
 *  via a multi-field Firestore orderBy) so this never needs a composite index. */
export async function fetchTimelists(uid: string): Promise<Timelist[]> {
  const snapshot = await getDocs(timelistsCol(uid))
  const timelists = snapshot.docs.map((d) => fromTimelistDoc(uid, d.id, d.data() as TimelistDoc))
  return timelists.sort((a, b) => b.year - a.year || b.month - a.month)
}

interface TimeEntryDoc {
  workplaceId: string
  date: string
  startTime: string | null
  stopTime: string | null
  totalHours: number
  isWeekend: boolean
  isHoliday: boolean
}

function fromTimeEntryDoc(uid: string, timelistId: string, id: string, data: TimeEntryDoc): TimeEntry {
  return {
    id,
    userId: uid,
    workplaceId: data.workplaceId,
    timelistId,
    date: data.date,
    startTime: data.startTime,
    stopTime: data.stopTime,
    totalHours: data.totalHours,
    isWeekend: data.isWeekend,
    isHoliday: data.isHoliday
  }
}

export async function fetchTimeEntriesForTimelist(uid: string, timelistId: string): Promise<TimeEntry[]> {
  const snapshot = await getDocs(query(entriesCol(uid, timelistId), orderBy('date', 'asc')))
  return snapshot.docs.map((d) => fromTimeEntryDoc(uid, timelistId, d.id, d.data() as TimeEntryDoc))
}

/** Creates (or reuses) the timelist for a given month/year, keyed by a deterministic
 *  "yyyy-MM" document id so re-generating the same month always lands on the same doc. */
export async function upsertTimelist(uid: string, month: number, year: number): Promise<Timelist> {
  const id = `${year}-${pad2(month)}`
  const ref = doc(timelistsCol(uid), id)
  const existing = await getDoc(ref)
  const data: TimelistDoc = {
    month,
    year,
    createdAt: existing.exists() ? (existing.data() as TimelistDoc).createdAt : new Date().toISOString()
  }
  await setDoc(ref, data)
  return fromTimelistDoc(uid, id, data)
}

const BATCH_CHUNK_SIZE = 450 // Firestore's write-batch limit is 500 ops; stay comfortably under it.

/** Persists every row of a generated timelist, keyed by a deterministic
 *  "workplaceId_date" document id so re-saves overwrite the same doc in place. */
export async function saveTimelistRows(uid: string, timelistId: string, rows: TimelistRow[]): Promise<void> {
  if (rows.length === 0) return

  for (let i = 0; i < rows.length; i += BATCH_CHUNK_SIZE) {
    const batch = writeBatch(db)
    for (const row of rows.slice(i, i + BATCH_CHUNK_SIZE)) {
      const entryId = `${row.workplaceId}_${row.date}`
      const data: TimeEntryDoc = {
        workplaceId: row.workplaceId,
        date: row.date,
        startTime: row.startTime,
        stopTime: row.stopTime,
        totalHours: row.totalHours,
        isWeekend: row.isWeekend,
        isHoliday: row.isHoliday
      }
      batch.set(doc(entriesCol(uid, timelistId), entryId), data)
    }
    await batch.commit()
  }
}
