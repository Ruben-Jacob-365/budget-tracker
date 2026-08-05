import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Category } from '../../types'
import { useStorage } from '../../hooks/useStorage'

const PRESET_EMOJIS = [
  '💪', '🍕', '🛒', '🚌', '⛽', '🏠', '💡', '🛍️',
  '🎬', '🏥', '📚', '✈️', '🛡️', '📊', '🎁', '📦',
  '💼', '💻', '📈', '↩️', '💰', '💵', '☕', '🎮',
]

const PRESET_COLORS = [
  '#6366f1', '#10b981', '#f97316', '#ef4444',
  '#8b5cf6', '#3b82f6', '#06b6d4', '#f43f5e',
  '#a855f7', '#22c55e', '#eab308', '#64748b',
]

const schema = z.object({
  name: z.string().min(1, 'Category name is required').max(30, 'Name too long'),
  type: z.enum(['income', 'expense']),
  icon: z.string().min(1, 'Please select or enter an emoji'),
  color: z.string().min(1, 'Please select a color'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  category?: Category
  onSuccess: () => void
}

export default function CategoryForm({ category, onSuccess }: Props) {
  const { storage } = useStorage()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? 'expense',
      icon: category?.icon ?? '💪',
      color: category?.color ?? '#6366f1',
    },
  })

  const type = watch('type')
  const currentIcon = watch('icon')
  const currentColor = watch('color')

  async function onSubmit(data: FormValues) {
    if (category) {
      await storage.updateCategory(category.id, {
        name: data.name.trim(),
        type: data.type,
        icon: data.icon,
        color: data.color,
      })
    } else {
      await storage.addCategory({
        name: data.name.trim(),
        type: data.type,
        icon: data.icon,
        color: data.color,
        isDefault: false,
      })
    }
    onSuccess()
  }

  async function handleDelete() {
    if (!category) return
    await storage.deleteCategory(category.id)
    onSuccess()
  }

  const inputCls = 'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Type Toggle */}
      <div className="flex rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700">
        {(['expense', 'income'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setValue('type', t, { shouldValidate: true })}
            aria-pressed={type === t}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              type === t
                ? t === 'income' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {t === 'income' ? '↑ Income' : '↓ Expense'}
          </button>
        ))}
      </div>

      {/* Category Name */}
      <div>
        <label htmlFor="cat-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Category Name
        </label>
        <input
          id="cat-name"
          type="text"
          placeholder="e.g. Gym, Subscriptions, Salary"
          autoFocus
          autoComplete="off"
          {...register('name')}
          className={inputCls}
        />
        {errors.name && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">{errors.name.message}</p>}
      </div>

      {/* Icon Picker */}
      <div>
        <label htmlFor="cat-icon" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Icon (Emoji)
        </label>
        <div className="flex items-center gap-2 mb-2">
          <input
            id="cat-icon"
            type="text"
            maxLength={4}
            {...register('icon')}
            className="w-16 px-3 py-2 text-center text-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">Pick below or type custom emoji</span>
        </div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          {PRESET_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => setValue('icon', emoji, { shouldValidate: true })}
              className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-transform ${
                currentIcon === emoji ? 'scale-110 bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500' : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {errors.icon && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">{errors.icon.message}</p>}
      </div>

      {/* Color Picker */}
      <div>
        <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Color
        </p>
        <div className="flex flex-wrap gap-2.5 items-center">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color', c, { shouldValidate: true })}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                currentColor === c ? 'scale-110 border-slate-900 dark:border-white ring-2 ring-indigo-500' : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Select color ${c}`}
            />
          ))}
          <input
            type="color"
            value={currentColor}
            onChange={e => setValue('color', e.target.value, { shouldValidate: true })}
            className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent p-0"
            title="Custom color"
          />
        </div>
        {errors.color && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">{errors.color.message}</p>}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {category && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete category"
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shrink-0"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors min-h-[48px]"
        >
          {isSubmitting ? 'Saving…' : category ? 'Save Changes' : 'Add Category'}
        </button>
      </div>
    </form>
  )
}
