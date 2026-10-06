import { describe, expect, it, vi } from 'vitest'
import { PAGE_SIZE, fetchAllPages } from './groups'

describe('fetchAllPages', () => {
  it('keeps requesting pages until a short page arrives', async () => {
    const total = PAGE_SIZE * 2 + 5
    const rows = Array.from({ length: total }, (_, i) => i)
    const page = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    await expect(fetchAllPages(page, 'x')).resolves.toEqual(rows)
    expect(page).toHaveBeenCalledTimes(3)
    expect(page).toHaveBeenNthCalledWith(2, PAGE_SIZE, PAGE_SIZE * 2 - 1)
  })

  it('stops after an exactly-full final page with one extra empty request', async () => {
    const rows = Array.from({ length: PAGE_SIZE }, (_, i) => i)
    const page = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    await expect(fetchAllPages(page, 'x')).resolves.toHaveLength(PAGE_SIZE)
    expect(page).toHaveBeenCalledTimes(2)
  })

  it('throws a friendly error', async () => {
    const page = async () => ({ data: null, error: { code: 'XX000', message: 'internal detail' } })
    await expect(fetchAllPages(page, 'We could not load the expenses.')).rejects.toThrow('We could not load the expenses.')
  })
})
