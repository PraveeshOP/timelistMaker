import type { WorkplaceTableData } from '@shared/domain'
import { useTimelist } from '../context/TimelistContext'
import { Button } from './ui/Button'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PATTERN_SOURCE_DAY_COUNT = 7

interface WorkplaceTableProps {
  table: WorkplaceTableData
}

export function WorkplaceTable({ table }: WorkplaceTableProps): React.JSX.Element {
  const { updateRowTime, updateRowTotalHours, updateRowDate, renameWorkplaceById, applyWeekPatternToMonth } =
    useTimelist()

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <input
          className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
          defaultValue={table.workplace.name}
          onBlur={(e) => {
            if (e.target.value !== table.workplace.name) {
              renameWorkplaceById(table.workplace.id, e.target.value)
            }
          }}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">
            Subtotal: {table.subtotalHours.toFixed(2)} h
          </span>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => applyWeekPatternToMonth(table.workplace.id)}
          >
            Repeat week 1 for rest of month
          </Button>
        </div>
      </div>
      <p className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs text-slate-400">
        Fill in the first 7 days below, then click "Repeat week 1 for rest of month" to apply that
        weekly pattern to the rest of the month.
      </p>

      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-2 py-2">Day</th>
              <th className="px-2 py-2">Start</th>
              <th className="px-2 py-2">Stop</th>
              <th className="px-2 py-2">Hours</th>
              <th className="px-2 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => {
              const dateObj = new Date(`${row.date}T00:00:00`)
              const special = row.isWeekend || row.isHoliday
              const isPatternBoundary = index === PATTERN_SOURCE_DAY_COUNT
              return (
                <tr
                  key={row.date}
                  className={`border-t ${isPatternBoundary ? 'border-t-2 border-indigo-200' : 'border-slate-100'} ${special ? 'bg-slate-50 text-slate-400' : ''}`}
                >
                  <td className="px-4 py-1.5">
                    <input
                      type="date"
                      className="rounded border-none bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      value={row.date}
                      onChange={(e) =>
                        updateRowDate(table.workplace.id, row.date, e.target.value)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs">{WEEKDAY_LABELS[dateObj.getDay()]}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      className="w-24 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      value={row.startTime ?? ''}
                      onChange={(e) =>
                        updateRowTime(table.workplace.id, row.date, 'startTime', e.target.value)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      className="w-24 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      value={row.stopTime ?? ''}
                      onChange={(e) =>
                        updateRowTime(table.workplace.id, row.date, 'stopTime', e.target.value)
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.25"
                      className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      value={row.totalHours}
                      onChange={(e) =>
                        updateRowTotalHours(table.workplace.id, row.date, Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-400">
                    {row.isHoliday ? row.holidayName : row.isWeekend ? 'Weekend' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
