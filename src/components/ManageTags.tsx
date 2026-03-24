import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addCategoryFn, addStoreFn } from '../services/grocery.api'
import clay from '../styles/clay.module.css'
import utils from '../styles/utils.module.css'
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
    <div className={`${utils.flex} ${utils.flexCol} ${utils.gap4}`}>
      <form onSubmit={handleSubmit} className={`${utils.flex} ${utils.gap2}`}>
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
          className={`${clay.button} ${utils.flex} ${utils.itemsCenter} ${utils.justifyCenter}`}
          style={{ padding: '0.75rem' }}
        >
          <Plus className={`${utils.h5} ${utils.w5}`} />
        </button>
      </form>

      <div className={`${utils.flex} ${utils.gap2} ${utils.p1}`} style={{ flexWrap: 'wrap', maxHeight: '15rem', overflowY: 'auto' }}>
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={`${utils.inlineFlex} ${utils.itemsCenter} ${utils.gap1_5} ${utils.px3} ${utils.py1_5} ${utils.roundedXl} ${utils.textSm} ${utils.fontMedium} ${utils.animateIn}`}
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--line)', color: 'var(--sea-ink)' }}
          >
            {type === 'category' ? <TagIcon className={`${utils.iconXs}`} style={{ color: '#ff9a9e' }} /> : <StoreIcon className={`${utils.iconXs}`} style={{ color: '#a18cd1' }} />}
            {tag.name}
          </span>
        ))}
        {tags.length === 0 && (
          <p className={`${utils.textSm} ${utils.wFull} ${utils.textCenter} ${utils.py3}`} style={{ color: 'var(--sea-ink-soft)', opacity: 0.5, fontStyle: 'italic' }}>
            No {type === 'category' ? 'categories' : 'stores'} added yet.
          </p>
        )}
      </div>
      
      <div className={`${utils.flex} ${utils.justifyEnd} ${utils.mt1}`} style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--line)' }}>
        <button 
          onClick={onClose}
          className={`${utils.textSm} ${utils.fontSemibold}`}
          style={{ color: 'var(--sea-ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
