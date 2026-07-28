import {
  Tag,
  Store as StoreIcon,
  Hash,
  Minus,
  Plus,
  Search,
} from 'lucide-react'
import formStyles from './AddItemForm.module.css'

export interface AddItemDetailsProps {
  variant: 'inline' | 'sheet'
  activePicker: 'quantity' | 'category' | 'store' | null
  onTogglePicker: (picker: 'quantity' | 'category' | 'store') => void
  displayQuantity: string
  displayCategory: string | null
  displayStore: string | null
  explicitQuantity: string
  onQuantityChange: (value: string) => void
  filteredCategories: any[]
  filteredStores: any[]
  categoryExactExists: boolean
  storeExactExists: boolean
  pickerSearch: string
  onPickerSearchChange: (search: string) => void
  onCategorySelect: (name: string | null) => void
  onStoreSelect: (name: string | null) => void
}

export default function AddItemDetails({
  variant,
  activePicker,
  onTogglePicker,
  displayQuantity,
  displayCategory,
  displayStore,
  explicitQuantity,
  onQuantityChange,
  filteredCategories,
  filteredStores,
  categoryExactExists,
  storeExactExists,
  pickerSearch,
  onPickerSearchChange,
  onCategorySelect,
  onStoreSelect,
}: AddItemDetailsProps) {
  const isSheet = variant === 'sheet'

  // In inline mode, picker chips are skipped (simplified view)
  // In sheet mode, show the full controls
  if (!isSheet) {
    return null
  }

  return (
    <>
      {/* ---- Metadata chips ---- */}
      <div className={formStyles.metadataRow}>
        <button
          type="button"
          className={`${formStyles.metadataChip} ${activePicker === 'quantity' ? formStyles.metadataChipActive : ''} ${explicitQuantity !== '1' ? formStyles.metadataChipSet : ''}`}
          onClick={() => onTogglePicker('quantity')}
          aria-expanded={activePicker === 'quantity'}
        >
          <Hash className={formStyles.metadataChipIcon} />
          {displayQuantity} item{displayQuantity !== '1' ? 's' : ''}
        </button>

        <button
          type="button"
          className={`${formStyles.metadataChip} ${activePicker === 'category' ? formStyles.metadataChipActive : ''} ${displayCategory ? formStyles.metadataChipSet : ''}`}
          onClick={() => onTogglePicker('category')}
          aria-expanded={activePicker === 'category'}
        >
          <Tag className={formStyles.metadataChipIcon} />
          {displayCategory || 'Category'}
        </button>

        <button
          type="button"
          className={`${formStyles.metadataChip} ${activePicker === 'store' ? formStyles.metadataChipActive : ''} ${displayStore ? formStyles.metadataChipSet : ''}`}
          onClick={() => onTogglePicker('store')}
          aria-expanded={activePicker === 'store'}
        >
          <StoreIcon className={formStyles.metadataChipIcon} />
          {displayStore || 'Store'}
        </button>
      </div>

      {/* ---- Quantity Picker ---- */}
      {activePicker === 'quantity' && (
        <div className={formStyles.pickerPanel}>
          <div className={formStyles.quantityControls}>
            <button
              type="button"
              className={formStyles.quantityBtn}
              disabled={parseInt(explicitQuantity, 10) <= 1}
              onClick={() =>
                onQuantityChange(
                  String(
                    Math.max(1, parseInt(explicitQuantity, 10) - 1),
                  ),
                )
              }
              aria-label="Decrease quantity"
            >
              <Minus className={formStyles.quantityBtnIcon} />
            </button>
            <input
              type="number"
              className={formStyles.quantityInput}
              value={explicitQuantity}
              onChange={(e) =>
                onQuantityChange(e.target.value)
              }
              min="1"
              step="1"
              inputMode="numeric"
              aria-label="Quantity"
            />
            <button
              type="button"
              className={formStyles.quantityBtn}
              onClick={() =>
                onQuantityChange(
                  String(parseInt(explicitQuantity, 10) + 1),
                )
              }
              aria-label="Increase quantity"
            >
              <Plus className={formStyles.quantityBtnIcon} />
            </button>
          </div>
        </div>
      )}

      {/* ---- Category Picker ---- */}
      {activePicker === 'category' && (
        <div className={formStyles.pickerPanel}>
          <div className={formStyles.pickerSearch}>
            <Search className={formStyles.pickerSearchIcon} />
            <input
              type="text"
              className={formStyles.pickerSearchInput}
              placeholder="Search categories"
              value={pickerSearch}
              onChange={(e) => onPickerSearchChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className={formStyles.pickerOptions}>
            <button
              type="button"
              className={`${formStyles.pickerOption} ${!displayCategory ? formStyles.pickerOptionSelected : ''}`}
              onClick={() => onCategorySelect(null)}
            >
              <span
                className={`${formStyles.pickerRadio} ${!displayCategory ? formStyles.pickerRadioChecked : ''}`}
              />
              No category
            </button>
            {filteredCategories.slice(0, 8).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${formStyles.pickerOption} ${displayCategory === cat.name ? formStyles.pickerOptionSelected : ''}`}
                onClick={() => onCategorySelect(cat.name)}
              >
                <span
                  className={`${formStyles.pickerRadio} ${displayCategory === cat.name ? formStyles.pickerRadioChecked : ''}`}
                />
                {cat.name}
              </button>
            ))}
            {pickerSearch &&
              !categoryExactExists &&
              pickerSearch.trim() && (
                <button
                  type="button"
                  className={`${formStyles.pickerOption} ${formStyles.pickerOptionNew}`}
                  onClick={() =>
                    onCategorySelect(pickerSearch.trim())
                  }
                >
                  <Plus className={formStyles.pickerNewIcon} />
                  Create "{pickerSearch.trim()}"
                </button>
              )}
          </div>
        </div>
      )}

      {/* ---- Store Picker ---- */}
      {activePicker === 'store' && (
        <div className={formStyles.pickerPanel}>
          <div className={formStyles.pickerSearch}>
            <Search className={formStyles.pickerSearchIcon} />
            <input
              type="text"
              className={formStyles.pickerSearchInput}
              placeholder="Search stores"
              value={pickerSearch}
              onChange={(e) => onPickerSearchChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className={formStyles.pickerOptions}>
            <button
              type="button"
              className={`${formStyles.pickerOption} ${!displayStore ? formStyles.pickerOptionSelected : ''}`}
              onClick={() => onStoreSelect(null)}
            >
              <span
                className={`${formStyles.pickerRadio} ${!displayStore ? formStyles.pickerRadioChecked : ''}`}
              />
              No store
            </button>
            {filteredStores.slice(0, 8).map((store) => (
              <button
                key={store.id}
                type="button"
                className={`${formStyles.pickerOption} ${displayStore === store.name ? formStyles.pickerOptionSelected : ''}`}
                onClick={() => onStoreSelect(store.name)}
              >
                <span
                  className={`${formStyles.pickerRadio} ${displayStore === store.name ? formStyles.pickerRadioChecked : ''}`}
                />
                {store.name}
              </button>
            ))}
            {pickerSearch &&
              !storeExactExists &&
              pickerSearch.trim() && (
                <button
                  type="button"
                  className={`${formStyles.pickerOption} ${formStyles.pickerOptionNew}`}
                  onClick={() =>
                    onStoreSelect(pickerSearch.trim())
                  }
                >
                  <Plus className={formStyles.pickerNewIcon} />
                  Create "{pickerSearch.trim()}"
                </button>
              )}
          </div>
        </div>
      )}
    </>
  )
}
