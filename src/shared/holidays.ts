import { addDays, format } from 'date-fns'

/** Gauss's Easter algorithm — returns the Gregorian date of Easter Sunday for a given year. */
function computeEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const MOVING_HOLIDAY_OFFSETS: Array<{ name: string; offset: number }> = [
  { name: 'Skjærtorsdag', offset: -3 }, // Maundy Thursday
  { name: 'Langfredag', offset: -2 }, // Good Friday
  { name: 'Første påskedag', offset: 0 }, // Easter Sunday
  { name: 'Andre påskedag', offset: 1 }, // Easter Monday
  { name: 'Kristi himmelfartsdag', offset: 39 }, // Ascension Day
  { name: 'Første pinsedag', offset: 49 }, // Whit Sunday
  { name: 'Andre pinsedag', offset: 50 } // Whit Monday
]

const FIXED_HOLIDAYS: Array<{ name: string; month: number; day: number }> = [
  { name: 'Første nyttårsdag', month: 1, day: 1 },
  { name: 'Arbeidernes dag', month: 5, day: 1 },
  { name: 'Grunnlovsdagen', month: 5, day: 17 },
  { name: 'Første juledag', month: 12, day: 25 },
  { name: 'Andre juledag', month: 12, day: 26 }
]

const cache = new Map<number, Map<string, string>>()

/** All Norwegian public holidays ("red days") for a given year, keyed by 'yyyy-MM-dd'. */
export function getNorwegianHolidays(year: number): Map<string, string> {
  const cached = cache.get(year)
  if (cached) return cached

  const map = new Map<string, string>()

  for (const { name, month, day } of FIXED_HOLIDAYS) {
    map.set(format(new Date(year, month - 1, day), 'yyyy-MM-dd'), name)
  }

  const easterSunday = computeEasterSunday(year)
  for (const { name, offset } of MOVING_HOLIDAY_OFFSETS) {
    map.set(format(addDays(easterSunday, offset), 'yyyy-MM-dd'), name)
  }

  cache.set(year, map)
  return map
}

export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear()
  const key = format(date, 'yyyy-MM-dd')
  return getNorwegianHolidays(year).get(key) ?? null
}

export function isNorwegianHoliday(date: Date): boolean {
  return getHolidayName(date) !== null
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}
