import { addMonths, formatMonthYear } from '../../utils/date'

interface Props {
  month: string
  onChange: (newMonth: string) => void
  className?: string
}

export default function MonthPicker({ month, onChange, className = '' }: Props) {
  return (
    <div className={`flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">
        {formatMonthYear(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Next month"
        className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>
  )
}
