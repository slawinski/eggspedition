import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Store, X, Trash2, Loader2 } from 'lucide-react'
import { updateQuickAddItemFn, addQuickAddItemFn, deleteQuickAddItemFn } from '../services/grocery.api'
import { useUndo } from '../hooks/useUndo'
import styles from './TemplateEditor.module.css'

interface QuickAddItem {
  id: string
  name: string
  categoryId?: string | null
  storeId?: string | null
  householdId?: string
  createdAt?: string
}

interface Category {
  id: string
  name: string
}

interface Store {
  id: string
  name: string
}

export interface TemplateEditorProps {
  isOpen: boolean
  onClose: () => void
  template?: QuickAddItem | null
  categories: Category[]
  stores: Store[]
  onSaved: () => void
  onDeleted: () => void
}

const DIALOG_LABEL_ID = 'template-editor-title'
const CATEGORY_LIST_ID = 'template-editor-category-list'
const STORE_LIST_ID = 'template-editor-store-list'

export default function TemplateEditor({
  isOpen,
  onClose,
  template,
  categories,
  stores,
  onSaved,
  onDeleted,
}: TemplateEditorProps) {
  const queryClient = useQueryClient()
  const undo = useUndo()
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [categoryName, setCategoryName] = useState(
    categories.find((c) => c.id === template?.categoryId)?.name ?? '',
  )
  const [storeName, setStoreName] = useState(
    stores.find((s) => s.id === template?.storeId)?.name ?? '',
  )
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset fields when template changes
  useEffect(() => {
    if (isOpen) {
      setName(template?.name ?? '')
      setCategoryName(categories.find((c) => c.id === template?.categoryId)?.name ?? '')
      setStoreName(stores.find((s) => s.id === template?.storeId)?.name ?? '')
      // Focus name field after animation
      requestAnimationFrame(() => {
        nameRef.current?.focus()
      })
    }
  }, [isOpen, template, categories, stores])

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: string; data: { name: string; categoryName: string; storeName: string } }) => {
      if (vars.id) {
        return updateQuickAddItemFn({ data: { id: vars.id, data: vars.data } })
      }
      return addQuickAddItemFn({ data: vars.data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      onSaved()
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickAddItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
      onDeleted()
      onClose()
    },
  })

  const handleSave = useCallback(() => {
    if (!name.trim()) return
    const cat = categoryName.trim() || undefined
    const sto = storeName.trim() || undefined
    saveMutation.mutate({
      id: template?.id,
      data: { name: name.trim(), categoryName: cat as any, storeName: sto as any },
    })
  }, [name, categoryName, storeName, template?.id, saveMutation])

  const handleDelete = useCallback(() => {
    if (!template) return

    // Push undoable delete
    const rollback = async () => {
      await addQuickAddItemFn({
        data: {
          name: template.name,
          categoryName: categoryName || null,
          storeName: storeName || null,
        },
      })
      queryClient.invalidateQueries({ queryKey: ['quick-add-items'] })
    }

    undo.pushCommand(
      {
        id: crypto.randomUUID(),
        type: 'deleteItem',
        householdId: template.householdId ?? '',
        itemId: template.id,
        itemSnapshot: { name: template.name, quantity: '1', categoryId: template.categoryId ?? null, storeId: template.storeId ?? null, checked: 'false' },
        optimisticCachePatches: [],
        userMessage: `${template.name} deleted`,
        expiryTimestamp: Date.now() + 5000,
      },
      rollback,
    )

    deleteMutation.mutate(template.id)
  }, [template, categoryName, storeName, deleteMutation, undo, queryClient])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="presentation">
      <div className={styles.sheet} role="dialog" aria-labelledby={DIALOG_LABEL_ID} aria-modal="true">
        {/* Header */}
        <div className={styles.header}>
          <h2 id={DIALOG_LABEL_ID} className={styles.title}>
            {isEdit ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <div className={styles.form}>
          {/* Name field */}
          <div className={styles.field}>
            <label htmlFor="template-editor-name" className={styles.label}>
              Name <span className={styles.required}>*</span>
            </label>
            <input
              ref={nameRef}
              id="template-editor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.input}
              placeholder="e.g. Milk, Bananas, Bread"
              autoComplete="off"
              required
              aria-required="true"
            />
          </div>

          {/* Category field */}
          <div className={styles.field}>
            <label htmlFor="template-editor-category" className={styles.label}>
              <Tag size={14} className={styles.fieldIcon} aria-hidden="true" />
              Category
            </label>
            <input
              id="template-editor-category"
              type="text"
              list={CATEGORY_LIST_ID}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.input}
              placeholder="e.g. Dairy, Produce"
              autoComplete="off"
              aria-describedby="template-editor-category-hint"
            />
            <datalist id={CATEGORY_LIST_ID}>
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <span id="template-editor-category-hint" className="sr-only">
              Choose from your existing categories
            </span>
          </div>

          {/* Store field */}
          <div className={styles.field}>
            <label htmlFor="template-editor-store" className={styles.label}>
              <Store size={14} className={styles.fieldIcon} aria-hidden="true" />
              Store
            </label>
            <input
              id="template-editor-store"
              type="text"
              list={STORE_LIST_ID}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.input}
              placeholder="e.g. Costco, Whole Foods"
              autoComplete="off"
              aria-describedby="template-editor-store-hint"
            />
            <datalist id={STORE_LIST_ID}>
              {stores.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
            <span id="template-editor-store-hint" className="sr-only">
              Choose from your existing stores
            </span>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!name.trim() || saveMutation.isPending}
              aria-busy={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
              ) : null}
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={saveMutation.isPending || deleteMutation.isPending}
            >
              Cancel
            </button>
          </div>

          {/* Delete — separated at bottom, only for edit mode */}
          {isEdit && (
            <div className={styles.deleteSection}>
              <div className={styles.deleteDivider} />
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                aria-busy={deleteMutation.isPending}
                aria-label={`Delete ${template?.name}`}
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
                ) : (
                  <Trash2 size={16} aria-hidden="true" />
                )}
                {deleteMutation.isPending ? 'Deleting...' : `Delete "${template?.name}"`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
