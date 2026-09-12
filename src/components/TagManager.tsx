import { useState } from 'react'
import {
  Pencil, Trash2, Check, X, Loader2,
  Tag as TagIcon, Store as StoreIcon,
} from 'lucide-react'
import styles from './TagManager.module.css'

export interface ManagedTag {
  id: string
  name: string
}

interface TagManagerProps {
  type: 'category' | 'store'
  tags: ManagedTag[]
  /** Item counts by tag id (all items, checked or not). */
  usageCounts: Record<string, number>
  /** Id of the tag with a mutation in flight, if any. */
  pendingId: string | null
  status: string | null
  error: string | null
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onDismissMessage: () => void
}

export default function TagManager({
  type, tags, usageCounts, pendingId, status, error,
  onRename, onDelete, onDismissMessage,
}: TagManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const TypeIcon = type === 'category' ? TagIcon : StoreIcon
  const unassignedLabel = type === 'category' ? 'Uncategorized' : 'Any Store'

  function startEdit(tag: ManagedTag) {
    onDismissMessage()
    setConfirmingId(null)
    setEditingId(tag.id)
    setDraft(tag.name)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft('')
  }

  function submitEdit(id: string, currentName: string) {
    const trimmed = draft.trim()
    if (!trimmed || trimmed.toLowerCase() === currentName.toLowerCase()) {
      cancelEdit()
      return
    }
    setEditingId(null)
    setDraft('')
    onRename(id, trimmed)
  }

  function askDelete(id: string) {
    onDismissMessage()
    cancelEdit()
    setConfirmingId((prev) => (prev === id ? null : id))
  }

  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      {status && (
        <p className={styles.statusMsg} role="status">
          <Check size={14} aria-hidden="true" />
          {status}
        </p>
      )}
      {error && (
        <p className={styles.errorMsg} role="alert">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className={styles.emptyText}>
          No {type === 'category' ? 'categories' : 'stores'} yet. New ones appear here when you add items.
        </p>
      ) : (
        <ul className={styles.list}>
          {sorted.map((tag) => {
            const count = usageCounts[tag.id] ?? 0
            const isPending = pendingId === tag.id
            const isEditing = editingId === tag.id
            const isConfirming = confirmingId === tag.id

            return (
              <li key={tag.id} className={styles.row}>
                <div className={styles.main}>
                  <TypeIcon size={16} className={styles.typeIcon} aria-hidden="true" />
                  {isEditing ? (
                    <form
                      className={styles.renameForm}
                      onSubmit={(e) => {
                        e.preventDefault()
                        submitEdit(tag.id, tag.name)
                      }}
                    >
                      <input
                        type="text"
                        className={styles.renameInput}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label={`Rename ${tag.name}`}
                        autoFocus
                        disabled={isPending}
                      />
                      <button
                        type="submit"
                        className={styles.iconBtn}
                        disabled={!draft.trim() || isPending}
                        aria-label="Save new name"
                      >
                        {isPending ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Check size={16} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={cancelEdit}
                        disabled={isPending}
                        aria-label="Cancel rename"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className={styles.tagName}>{tag.name}</span>
                      <span className={styles.count} title={`${count} item${count === 1 ? '' : 's'} use this`}>
                        {count === 0 ? 'Unused' : `${count} item${count === 1 ? '' : 's'}`}
                      </span>
                      <span className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => startEdit(tag)}
                          disabled={isPending}
                          aria-label={`Rename ${tag.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.dangerBtn}`}
                          onClick={() => askDelete(tag.id)}
                          disabled={isPending}
                          aria-label={`Delete ${tag.name}`}
                          aria-expanded={isConfirming}
                        >
                          {isPending ? (
                            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 size={16} aria-hidden="true" />
                          )}
                        </button>
                      </span>
                    </>
                  )}
                </div>

                {isConfirming && !isEditing && (
                  <div className={styles.confirmBar}>
                    <span className={styles.confirmText}>
                      Delete &ldquo;{tag.name}&rdquo;?
                      {count > 0 && (
                        <> {count} item{count === 1 ? '' : 's'} move{count === 1 ? 's' : ''} to {unassignedLabel}.</>
                      )}
                    </span>
                    <span className={styles.confirmActions}>
                      <button
                        type="button"
                        className={styles.confirmDeleteBtn}
                        onClick={() => {
                          setConfirmingId(null)
                          onDelete(tag.id)
                        }}
                        disabled={isPending}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => setConfirmingId(null)}
                        disabled={isPending}
                      >
                        Keep
                      </button>
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
