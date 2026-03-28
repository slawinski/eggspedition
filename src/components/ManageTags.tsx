import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCategoryFn, addStoreFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import styles from './ManageTags.module.css'
import { Plus, Tag as TagIcon, Store as StoreIcon } from 'lucide-react'

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    addMutation.mutate(newName)
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Add new ${type}...`}
          className={clay.input}
          autoFocus
        />
        <button
          type="submit"
          disabled={!newName.trim() || addMutation.isPending}
          className={`${clay.button} ${styles.submitButton}`}
        >
          <Plus className={styles.plusIcon} />
        </button>
      </form>

      <div className={styles.tagList}>
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={styles.tagChip}
          >
            {type === 'category' ? (
              <TagIcon className={`${styles.tagIcon} ${styles.categoryIcon}`} />
            ) : (
              <StoreIcon className={`${styles.tagIcon} ${styles.storeIcon}`} />
            )}
            <span className={styles.tagName}>{tag.name}</span>
          </span>
        ))}
        {tags.length === 0 && (
          <p className={styles.emptyState}>
            No {type === 'category' ? 'categories' : 'stores'} added yet.
          </p>
        )}
      </div>
      
      <div className={styles.footer}>
        <button 
          onClick={onClose}
          className={styles.doneButton}
        >
          Done
        </button>
      </div>
    </div>
  )
}
