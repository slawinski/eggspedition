// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GroceryItem } from '../lib/schemas'
import { toItemSnapshot } from '../lib/commands'

vi.mock('react', async () => {
  const { createRequire } = await import('node:module')
  const react = createRequire(import.meta.url)('react')
  return { ...react, default: react }
})
const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  pushCommand: vi.fn(),
  removeCommand: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouteContext: () => ({ session: { householdId: 'household' } }),
}))
vi.mock('../services/grocery.api', () => ({
  updateGroceryItemFn: mocks.update,
  deleteGroceryItemFn: vi.fn(),
  addCategoryFn: vi.fn(),
  addStoreFn: vi.fn(),
  addGroceryItemFn: vi.fn(),
}))
vi.mock('../hooks/useUndo', () => ({
  useUndo: () => ({ pushCommand: mocks.pushCommand, removeCommand: mocks.removeCommand }),
}))
vi.mock('./ManageTagsButton', () => ({ default: () => null }))
import ItemEditor from './ItemEditor'

const item: GroceryItem = {
  id: 'item', householdId: 'household', userId: 'user',
  name: 'Milk', quantity: '1', checked: 'false', categoryId: null, storeId: null, version: 1,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
}
const clients: QueryClient[] = []

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.setAttribute('open', '') } },
    close: { configurable: true, value() { this.removeAttribute('open') } },
  })
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

async function editItem() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  clients.push(client)
  client.setQueryData(['grocery-items-grouped', 'category', 'household'], {
    uncategorized: { items: [item] },
  })
  const onSaved = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <ItemEditor isOpen onClose={vi.fn()} item={item} categories={[]} stores={[]}
        activeItems={[item]} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Oat milk' } })
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  return onSaved
}

it('saves edits before a server result exists and preserves the original values for undo', async () => {
  const updated = { ...item, name: 'Oat milk', quantity: '2' }
  let resolveSave!: (value: GroceryItem) => void
  mocks.update.mockImplementationOnce(() => new Promise<GroceryItem>((resolve) => { resolveSave = resolve }))
  const onSaved = await editItem()

  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
  expect(mocks.update).toHaveBeenCalledWith({ data: {
    id: item.id, data: { name: 'Oat milk', quantity: '2', categoryId: null, storeId: null },
  } })
  expect(onSaved).not.toHaveBeenCalled()
  expect(mocks.pushCommand).toHaveBeenCalledTimes(1)
  const [command, rollback] = mocks.pushCommand.mock.calls[0]
  expect(command.itemSnapshot).toEqual(toItemSnapshot(updated))
  expect(command.previousSnapshot).toEqual(toItemSnapshot(item))
  expect(command.userMessage).toBe('Oat milk updated.')

  await act(async () => { resolveSave(updated) })
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated))
  expect(mocks.pushCommand).toHaveBeenCalledTimes(1)
  await act(async () => { await rollback() })
  expect(mocks.update).toHaveBeenLastCalledWith({ data: {
    id: item.id, data: { name: 'Milk', quantity: '1', categoryId: null, storeId: null },
  } })
})

it('shows a failed save and removes its optimistic undo command', async () => {
  mocks.update.mockRejectedValueOnce(new Error('Could not save item'))
  const onSaved = await editItem()

  await waitFor(() => expect(screen.getByText('Could not save item')).toBeTruthy())
  expect(onSaved).not.toHaveBeenCalled()
  expect(mocks.pushCommand).toHaveBeenCalledTimes(1)
  expect(mocks.removeCommand).toHaveBeenCalledWith(mocks.pushCommand.mock.calls[0][0].id)
})
