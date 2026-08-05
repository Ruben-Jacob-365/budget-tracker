import { useState, useEffect, useCallback } from 'react'
import { useStorage } from './useStorage'
import type { Category } from '../types'

export function useCategories() {
  const { storage } = useStorage()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const data = await storage.getCategories()
    setCategories(data)
    setLoading(false)
  }, [storage])

  useEffect(() => {
    reload()
  }, [reload])

  return { categories, loading, reload }
}
