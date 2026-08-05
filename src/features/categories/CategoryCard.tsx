import type { Category } from '../../types'

interface Props {
  category: Category
  onEdit: () => void
}

export default function CategoryCard({ category, onEdit }: Props) {
  const isIncome = category.type === 'income'
  const color = category.color ?? '#64748b'
  const icon = category.icon ?? '📦'

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: `${color}25` }}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{category.name}</p>
        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
          isIncome
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
        }`}>
          {isIncome ? 'Income' : 'Expense'}
        </span>
      </div>

      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
        Edit
      </span>
    </button>
  )
}
