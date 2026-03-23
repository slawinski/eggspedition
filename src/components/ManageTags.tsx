import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCategoryFn, addStoreFn } from '../services/grocery.api'
import styles from '../styles/clay.module.css'
import { Plus, Tag, Store as StoreIcon } from 'lucide-react'

interface Tag {
  id: string
  name: string
}

interface ManageTagsProps {
  type: 'category' | 'store'
  tags: Tag[]
  onClose: () => void
}

export default function ManageTags({ type, tags, onClose }: ManageTagsProps) {
  const [newName, setNewName] = useState('')
  const queryClient = useQueryClient()
  const key = type === 'category' ? 'categories' : 'stores'

  const addMutation = useMutation({
    mutationFn: (name: string) => type === 'category' ? addCategoryFn({ data: name }) : addStoreFn({ data: name }),
    onSuccess: () => {
      setNewName('')
      queryClient.invalidateQueries({ queryKey: [key] })
      queryClient.invalidateQueries({ queryKey: ['grocery-items-grouped'] })
    }
  })

  // Note: We don't have delete API exposed yet for categories/stores, so just Add for now.
  // The user asked to "add and use".

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    addMutation.mutate(newName)
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Add new ${type}...`}
          className={styles.input}
          autoFocus
        />
        <button
          type="submit"
          disabled={!newName.trim() || addMutation.isPending}
          className={`${styles.button} !p-3 flex items-center justify-center`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/50 border border-[var(--line)] text-sm font-medium text-[var(--sea-ink)] animate-in zoom-in-95 duration-200"
          >
            {type === 'category' ? <Tag className="h-3 w-3 text-[#ff9a9e]" /> : <StoreIcon className="h-3 w-3 text-[#a18cd1]" />}
            {tag.name}
          </span>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-[var(--sea-ink-soft)] opacity-50 italic w-full text-center py-4">
            No {type === 'category' ? 'categories' : 'stores'} added yet.
          </p>
        )}
      </div>
      
      <div className="flex justify-end pt-2 border-t border-[var(--line)]">
        <button 
          onClick={onClose}
          className="text-sm text-[var(--sea-ink-soft)] font-semibold hover:text-[var(--sea-ink)]"
        >
          Done
        </button>
      </div>
    </div>
  )
}
