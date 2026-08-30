import { describe, it, expect } from 'vitest'
import {
  moveItemBetweenGroups,
  updateItemInList,
} from './grouped-cache'

const prev = {
  catA: { category: { name: 'dairy' }, items: [{ id: 'i1', name: 'Milk', categoryId: 'catA', storeId: null }] },
  unassigned: { category: null, items: [{ id: 'i2', name: 'Bread', categoryId: null, storeId: null }] },
}

describe('moveItemBetweenGroups', () => {
  it('moves an item from one group to another', () => {
    const result = moveItemBetweenGroups(prev, {
      id: 'i1',
      data: { categoryId: null },
    }) as typeof prev
    expect(result.unassigned.items[0]).toMatchObject({ id: 'i1', categoryId: null })
    expect(result.catA.items).toHaveLength(0)
    expect(result.unassigned.items).toHaveLength(2)
  })

  it('keeps the target group metadata intact', () => {
    const result = moveItemBetweenGroups(prev, {
      id: 'i1',
      data: { categoryId: null },
    }) as typeof prev
    expect(result.unassigned.category).toBeNull()
  })

  it('sorts the target group by createdAt DESC like the server', () => {
    const withDates = {
      catA: { items: [{ id: 'old', createdAt: '2026-01-01T00:00:00Z' }, { id: 'new', createdAt: '2026-06-01T00:00:00Z' }] },
      catB: { items: [{ id: 'mid', createdAt: '2026-03-01T00:00:00Z' }] },
    }
    const result = moveItemBetweenGroups(withDates, {
      id: 'old',
      data: { categoryId: 'catB' },
    }) as typeof withDates
    // catB: mid (March) then old (January) — newest first
    expect(result.catB.items.map((i) => i.id)).toEqual(['mid', 'old'])
  })

  it('returns previous value when the item is missing', () => {
    expect(
      moveItemBetweenGroups(prev, { id: 'nope', data: { categoryId: null } }),
    ).toBe(prev)
  })

  it('returns previous value for non-object input', () => {
    expect(moveItemBetweenGroups([], { id: 'i1', data: { categoryId: null } })).toEqual([])
  })

  it('returns previous value when no move dimension is set', () => {
    expect(moveItemBetweenGroups(prev, { id: 'i1', data: {} })).toBe(prev)
  })
})

describe('updateItemInList', () => {
  it('patches the matching item in a flat list', () => {
    const list = [{ id: 'i1', categoryId: 'catA' }, { id: 'i2', categoryId: null }]
    const result = updateItemInList(list, { id: 'i1', data: { categoryId: null } }) as typeof list
    expect(result[0]).toEqual({ id: 'i1', categoryId: null })
    expect(result[1]).toEqual({ id: 'i2', categoryId: null })
  })

  it('returns previous value for non-array input', () => {
    expect(updateItemInList({}, { id: 'i1', data: { categoryId: null } })).toEqual({})
  })
})
