import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addGroceryItemFn } from '../services/grocery.api'
import type { GroceryItem } from '../lib/schemas'

type AddGroceryItemInput = {
  name: string
  quantity?: string
  categoryId?: string
  storeId?: string
  categoryName?: string | null
  storeName?: string | null
}

interface UseAddGroceryItemOptions {
  onSuccess?: (
    result: GroceryItem,
    variables: AddGroceryItemInput,
  ) => void
  onError?: (
    error: Error,
    variables?: AddGroceryItemInput,
  ) => void
}

export function useAddGroceryItem(options?: UseAddGroceryItemOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddGroceryItemInput) =>
      addGroceryItemFn({ data }),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['grocery-items'] })
      queryClient.invalidateQueries({
        queryKey: ['grocery-items-grouped'],
      })
      queryClient.invalidateQueries({ queryKey: ['household-logs'] })
      queryClient.invalidateQueries({ queryKey: ['frequent-items'] })
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
      options?.onSuccess?.(result, variables)
    },
    onError: (error: Error, variables) => {
      options?.onError?.(error, variables)
    },
  })
}

export type { AddGroceryItemInput }
