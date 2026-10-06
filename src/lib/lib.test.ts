import { describe, expect, it } from 'vitest'
import { AppError, GENERIC_ERROR, NETWORK_ERROR, getErrorCode, getErrorMessage } from './errors'
import { authPath, inviteUrl, safeNextPath, whatsappShareUrl } from './navigation'

describe('getErrorMessage', () => {
  it('maps business-rule codes raised by the database', () => {
    expect(getErrorMessage({ message: 'SPLIT_TOTAL_MISMATCH', code: 'P0001' })).toMatch(/add up/)
    expect(getErrorCode({ message: 'MEMBER_HAS_BALANCE', code: 'P0001' })).toBe('MEMBER_HAS_BALANCE')
  })

  it('maps auth errors', () => {
    expect(getErrorMessage({ name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Incorrect email or password.',
    )
  })

  it('maps permission and network errors', () => {
    expect(getErrorMessage({ code: '42501', message: 'permission denied for table expenses' })).toMatch(/permission/)
    expect(getErrorMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR)
  })

  it('never leaks raw database messages', () => {
    const raw = { code: 'XX000', message: 'relation "public.secret" does not exist at character 42' }
    expect(getErrorMessage(raw)).toBe(GENERIC_ERROR)
  })

  it('passes AppError messages through', () => {
    expect(getErrorMessage(new AppError('Friendly'))).toBe('Friendly')
  })
})

describe('safeNextPath', () => {
  it('allows relative in-app paths', () => {
    expect(safeNextPath('/join/abc')).toBe('/join/abc')
    expect(safeNextPath('/groups/1?tab=x')).toBe('/groups/1?tab=x')
  })

  it.each(['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '/https://x', ''])(
    'rejects %j',
    (value) => {
      expect(safeNextPath(value)).toBe('/dashboard')
    },
  )

  it('builds auth links that come back to the invite', () => {
    expect(authPath('login', '/join/tok')).toBe('/login?next=%2Fjoin%2Ftok')
    expect(authPath('signup')).toBe('/signup')
  })
})

describe('sharing', () => {
  it('builds invite and WhatsApp links', () => {
    const link = inviteUrl('tok_123', 'https://nettly.app')
    expect(link).toBe('https://nettly.app/join/tok_123')
    const wa = whatsappShareUrl('Delhi Trip 2026', link)
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(wa.split('text=')[1]!)).toBe(
      'Join our Nettly group: Delhi Trip 2026\n\nJoin here:\nhttps://nettly.app/join/tok_123',
    )
  })
})
