import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Edit2, Check, X, Tag, Store, MoreHorizontal, Plus, ChevronRight } from "lucide-react";
import {
  getQuickAddItemsFn,
  updateQuickAddItemFn,
  deleteQuickAddItemFn,
  addQuickAddItemFn,
  getCategoriesFn,
  getStoresFn,
  getFrequentItemsFn,
} from "../services/grocery.api";
import { useUndo } from "../hooks/useUndo";
import TemplateEditor from "./TemplateEditor";
import styles from "./AdminDashboard.module.css";

// ── types ────────────────────────────────────────────────────

interface QuickAddItem {
  id: string;
  name: string;
  categoryId?: string | null;
  storeId?: string | null;
  householdId?: string;
  createdAt?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface FrequentItem {
  name: string;
  count: number;
}

interface AdminDashboardProps {
  householdId?: string;
}

// ── main component ───────────────────────────────────────────

export default function QuickAddTemplateManager({
  householdId,
}: AdminDashboardProps) {
  const queryClient = useQueryClient();
  const undo = useUndo();

  // Dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuickAddItem | null>(null);

  // Mobile overflow menu state (which card's menu is open)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // ── queries ──────────────────────────────────────────────

  const {
    data: items = [],
    isLoading: isLoadingItems,
    isError: isErrorItems,
  } = useQuery({
    queryKey: ["quick-add-items", householdId],
    queryFn: () => getQuickAddItemsFn(),
    enabled: !!householdId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", householdId],
    queryFn: () => getCategoriesFn(),
    enabled: !!householdId,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["stores", householdId],
    queryFn: () => getStoresFn(),
    enabled: !!householdId,
  });

  const { data: frequentItems = [] } = useQuery({
    queryKey: ["frequent-items", householdId],
    queryFn: () => getFrequentItemsFn(),
    enabled: !!householdId,
  });

  const sortedItems = useMemo(() => {
    return ([...items] as unknown as QuickAddItem[]).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  // Frequent items that aren't already templates
  const suggestedItems = useMemo(() => {
    const templateNames = new Set(items.map((i) => i.name.toLowerCase()));
    return (frequentItems as FrequentItem[])
      .filter((f) => !templateNames.has(f.name.toLowerCase()))
      .slice(0, 6);
  }, [frequentItems, items]);

  // ── mutations ────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuickAddItemFn({ data: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-add-items"] });
    },
  });

  const addSuggestedMutation = useMutation({
    mutationFn: (name: string) =>
      addQuickAddItemFn({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-add-items"] });
    },
  });

  // ── handlers ─────────────────────────────────────────────

  function handleOpenCreate() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function handleOpenEdit(template: QuickAddItem) {
    setEditingTemplate(template);
    setEditorOpen(true);
    setMenuOpenId(null);
  }

  function handleCloseEditor() {
    setEditorOpen(false);
    setEditingTemplate(null);
  }

  function handleDeleteItem(item: QuickAddItem) {
    const rollback = async () => {
      await addQuickAddItemFn({
        data: {
          name: item.name,
          categoryName:
            categories.find((c) => c.id === item.categoryId)?.name ?? null,
          storeName:
            stores.find((s) => s.id === item.storeId)?.name ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["quick-add-items"] });
    };

    undo.pushCommand(
      {
        id: crypto.randomUUID(),
        type: "deleteItem",
        householdId: item.householdId ?? "",
        itemId: item.id,
        itemSnapshot: {
          name: item.name,
          quantity: "1",
          categoryId: item.categoryId ?? null,
          storeId: item.storeId ?? null,
          checked: "false",
        },
        optimisticCachePatches: [],
        userMessage: `${item.name} deleted`,
        expiryTimestamp: Date.now() + 5000,
      },
      rollback,
    );

    deleteMutation.mutate(item.id);
    setMenuOpenId(null);
  }

  function handleAddSuggested(name: string) {
    addSuggestedMutation.mutate(name);
  }

  // Close mobile menu on outside click
  function handleMenuClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === id ? null : id);
  }

  // ── derived data for helpers ──────────────────────────────

  const count = sortedItems.length;
  const hasSuggested = suggestedItems.length > 0;

  return (
    <div className={styles.container}>
      {/* ── Section header ───────────────────────────────────── */}
      <div className={styles.sectionHeader}>
        <p className={styles.sectionCount}>
          {isLoadingItems
            ? "Loading..."
            : `${count} template${count !== 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          className={styles.createBtn}
          onClick={handleOpenCreate}
          aria-label="Create new template"
        >
          <Plus size={16} aria-hidden="true" />
          New Template
        </button>
      </div>

      {/* ── Desktop: Table ───────────────────────────────────── */}
      <div className={styles.desktopOnly}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Metadata</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingItems ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={3} className={styles.skeletonRow} />
                  </tr>
                ))
              ) : isErrorItems ? (
                <tr>
                  <td colSpan={3} className={styles.errorState}>
                    Failed to load templates. Pull down to retry.
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyState}>
                    No templates yet. Create one above or add from suggestions below.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <DesktopTemplateRow
                    key={item.id}
                    item={item}
                    categories={categories}
                    stores={stores}
                    onEdit={() => handleOpenEdit(item)}
                    onDelete={() => handleDeleteItem(item)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: Card Layout ──────────────────────────────── */}
      <div className={styles.mobileOnly}>
        {isLoadingItems ? (
          <div className={styles.cardList} role="status" aria-label="Loading templates">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${styles.mobileCard} ${styles.mobileCardSkeleton}`}>
                <div className={styles.skeletonLine} style={{ width: "60%" }} />
                <div className={styles.skeletonLine} style={{ width: "40%" }} />
              </div>
            ))}
          </div>
        ) : isErrorItems ? (
          <div className={styles.errorState}>
            Failed to load templates. Pull down to retry.
          </div>
        ) : sortedItems.length === 0 ? (
          <div className={styles.emptyState}>
            No templates yet. Create one above or add from suggestions below.
          </div>
        ) : (
          <ul className={styles.cardList} role="list" aria-label="Quick Add templates">
            {sortedItems.map((item) => {
              const cat = categories.find((c: any) => c.id === item.categoryId);
              const sto = stores.find((s: any) => s.id === item.storeId);
              return (
                <li key={item.id} className={styles.cardListItem}>
                  <button
                    type="button"
                    className={styles.mobileCard}
                    onClick={() => handleOpenEdit(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    <div className={styles.mobileCardBody}>
                      <span className={styles.mobileCardName}>{item.name}</span>
                      <div className={styles.mobileCardChips}>
                        {cat && (
                          <span className={`${styles.tag} ${styles.tagCategory}`}>
                            <Tag className={styles.subInfoIcon} aria-hidden="true" />
                            {cat.name}
                          </span>
                        )}
                        {sto && (
                          <span className={`${styles.tag} ${styles.tagStore}`}>
                            <Store className={styles.subInfoIcon} aria-hidden="true" />
                            {sto.name}
                          </span>
                        )}
                        {!cat && !sto && (
                          <span className={styles.noTags}>No metadata</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.mobileCardTrailing}>
                      <button
                        type="button"
                        className={styles.menuTrigger}
                        onClick={(e) => handleMenuClick(e, item.id)}
                        aria-label={`More options for ${item.name}`}
                        aria-expanded={menuOpenId === item.id}
                        aria-haspopup="true"
                      >
                        <MoreHorizontal size={20} aria-hidden="true" />
                      </button>

                      {menuOpenId === item.id && (
                        <div
                          className={styles.menuPopover}
                          role="menu"
                          aria-label={`Actions for ${item.name}`}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.menuItem}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(item);
                            }}
                          >
                            <Edit2 size={14} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.menuItemDestructive}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item);
                            }}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      size={16}
                      className={styles.mobileChevron}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Suggested from recent items ──────────────────────── */}
      {hasSuggested && !isLoadingItems && (
        <section className={styles.suggestedSection}>
          <h3 className={styles.suggestedTitle}>Suggested from recent items</h3>
          <p className={styles.suggestedSubtitle}>
            Frequently added items that aren't templates yet.
          </p>
          <ul className={styles.cardList} role="list" aria-label="Suggested items">
            {(suggestedItems as FrequentItem[]).map((fi) => (
              <li key={fi.name} className={styles.cardListItem}>
                <div className={styles.suggestedCard}>
                  <div className={styles.suggestedCardBody}>
                    <span className={styles.mobileCardName}>{fi.name}</span>
                    <span className={styles.suggestedCount}>
                      Added {fi.count} time{fi.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.suggestedAddBtn}
                    onClick={() => handleAddSuggested(fi.name)}
                    disabled={addSuggestedMutation.isPending}
                    aria-label={`Add ${fi.name} to Quick Add`}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Add to Quick Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Template Editor Dialog ───────────────────────────── */}
      <TemplateEditor
        isOpen={editorOpen}
        onClose={handleCloseEditor}
        template={editingTemplate}
        categories={categories}
        stores={stores}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["quick-add-items"] });
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          queryClient.invalidateQueries({ queryKey: ["stores"] });
        }}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["quick-add-items"] });
        }}
      />
    </div>
  );
}

// ── Desktop row components ────────────────────────────────────

function DesktopTemplateRow({
  item,
  categories,
  stores,
  onEdit: _onEdit,
  onDelete,
}: {
  item: QuickAddItem;
  categories: Category[];
  stores: Store[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <DesktopTemplateRowEdit
        item={item}
        categories={categories}
        stores={stores}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <DesktopTemplateRowView
      item={item}
      categories={categories}
      stores={stores}
      onEdit={() => setIsEditing(true)}
      onDelete={onDelete}
    />
  );
}

function DesktopTemplateRowView({
  item,
  categories,
  stores,
  onEdit,
  onDelete,
}: {
  item: QuickAddItem;
  categories: Category[];
  stores: Store[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const currentCategory = categories.find((c) => c.id === item.categoryId);
  const currentStore = stores.find((s) => s.id === item.storeId);

  return (
    <tr className={styles.itemRow}>
      <td>
        <span className={styles.itemName}>{item.name}</span>
      </td>
      <td>
        <div className={styles.itemTags}>
          {currentCategory && (
            <span className={`${styles.tag} ${styles.tagCategory}`}>
              <Tag className={styles.subInfoIcon} aria-hidden="true" />
              {currentCategory.name}
            </span>
          )}
          {currentStore && (
            <span className={`${styles.tag} ${styles.tagStore}`}>
              <Store className={styles.subInfoIcon} aria-hidden="true" />
              {currentStore.name}
            </span>
          )}
          {!currentCategory && !currentStore && (
            <span className={styles.noTags}>No metadata</span>
          )}
        </div>
      </td>
      <td>
        <div className={styles.itemActions}>
          <button
            onClick={onEdit}
            className={styles.actionBtn}
            aria-label={`Edit ${item.name}`}
          >
            <Edit2 className={styles.actionIcon} aria-hidden="true" />
          </button>
          <button
            onClick={onDelete}
            className={styles.deleteBtn}
            aria-label={`Delete ${item.name}`}
          >
            <Trash2 className={styles.actionIcon} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function DesktopTemplateRowEdit({
  item,
  categories,
  stores,
  onCancel,
}: {
  item: QuickAddItem;
  categories: Category[];
  stores: Store[];
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(item.name);
  const [categoryName, setCategoryName] = useState(
    categories.find((c) => c.id === item.categoryId)?.name || "",
  );
  const [storeName, setStoreName] = useState(
    stores.find((s) => s.id === item.storeId)?.name || "",
  );

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      data: { name: string; categoryName: string; storeName: string };
    }) => updateQuickAddItemFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-add-items"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      onCancel();
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;
    updateMutation.mutate({
      id: item.id,
      data: { name: name.trim(), categoryName, storeName },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <tr className={`${styles.itemRow} ${styles.itemRowEditing}`}>
      <td>
        <label htmlFor={`desktop-edit-name-${item.id}`} className="sr-only">
          Edit name for {item.name}
        </label>
        <input
          id={`desktop-edit-name-${item.id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.editNameInput}
          placeholder="Item name"
          autoFocus
        />
      </td>
      <td>
        <div className={styles.itemTags}>
          <div className={styles.tagEditWrapper}>
            <Tag className={styles.subInfoIcon} aria-hidden="true" />
            <label htmlFor={`desktop-edit-cat-${item.id}`} className="sr-only">
              Category
            </label>
            <input
              id={`desktop-edit-cat-${item.id}`}
              type="text"
              list={`category-list-${item.id}`}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.tagInput}
              placeholder="Category"
            />
          </div>
          <div className={styles.tagEditWrapper}>
            <Store className={styles.subInfoIcon} aria-hidden="true" />
            <label htmlFor={`desktop-edit-store-${item.id}`} className="sr-only">
              Store
            </label>
            <input
              id={`desktop-edit-store-${item.id}`}
              type="text"
              list={`store-list-${item.id}`}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.tagInput}
              placeholder="Store"
            />
          </div>
        </div>
      </td>
      <td>
        <div className={styles.itemActions}>
          <button
            onClick={handleSave}
            className={styles.saveBtn}
            disabled={updateMutation.isPending || !name.trim()}
            aria-label={`Save ${name}`}
          >
            {updateMutation.isPending ? (
              <div className={styles.spinner} />
            ) : (
              <Check className={styles.actionIcon} aria-hidden="true" />
            )}
          </button>
          <button
            onClick={onCancel}
            className={styles.cancelBtn}
            aria-label="Cancel editing"
          >
            <X className={styles.actionIcon} aria-hidden="true" />
          </button>
        </div>

        <datalist id={`category-list-${item.id}`}>
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <datalist id={`store-list-${item.id}`}>
          {stores.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </td>
    </tr>
  );
}
