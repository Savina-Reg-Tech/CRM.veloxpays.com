import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/store/authStore'
import type { User, UserRole } from '@/types'
import type { AuditSettings } from '../../auditTypes'

const mutateAsync = vi.fn()
let settingsData: AuditSettings | undefined
vi.mock('../../hooks/useVVAudit', () => ({
  useVVAuditSettings: () => ({ data: settingsData, isLoading: false, isError: false }),
  useVVAuditUpdateSettings: () => ({ mutateAsync, isPending: false }),
}))

import ToastProvider from '@/app/providers/ToastProvider'
import ApiLogSettingsCard from './ApiLogSettingsCard'

const apiLogs = { enabled: true, capture: 'all' as const, bodies: true, retentionDays: 7, minRetentionDays: 1, maxRetentionDays: 30 }
const baseSettings: AuditSettings = {
  retentionDays: 5,
  summaryRetentionDays: 365,
  alertsEnabled: true,
  thresholds: {} as AuditSettings['thresholds'],
  minRetentionDays: 5,
  updatedBy: null,
  updatedAt: '2026-10-18T10:00:00.000Z',
  apiLogs,
}

function signIn(role: UserRole) {
  useAuthStore.setState({ user: { id: 1, name: 'Staff', email: 'staff@example.com', role } as unknown as User })
}

const renderCard = () => render(<ToastProvider><ApiLogSettingsCard /></ToastProvider>)
const saveButton = () => screen.getByRole('button', { name: /save api log settings/i })

beforeEach(() => {
  settingsData = { ...baseSettings, apiLogs: { ...apiLogs } }
  mutateAsync.mockReset()
  signIn('admin')
})
afterEach(() => useAuthStore.setState({ user: null }))

describe('ApiLogSettingsCard', () => {
  it('is hidden for support staff', () => {
    signIn('support')
    renderCard()
    expect(screen.queryByText('API logs')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save api log settings/i })).not.toBeInTheDocument()
  })

  it('shows a short note on VeloxVerse builds without API logs', () => {
    settingsData = { ...baseSettings, apiLogs: undefined }
    renderCard()
    expect(screen.getByText(/doesn.t have API logs yet/i)).toBeInTheDocument()
  })

  it('keeps Save disabled until something changes', async () => {
    renderCard()
    expect(saveButton()).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /problems only/i }))
    expect(saveButton()).toBeEnabled()
    await userEvent.click(screen.getByRole('radio', { name: /everything/i }))
    expect(saveButton()).toBeDisabled()
  })

  it('sends only the changed keys', async () => {
    mutateAsync.mockResolvedValue({ ...baseSettings, apiLogs: { ...apiLogs, capture: 'errors_only', retentionDays: 10 } })
    renderCard()
    await userEvent.click(screen.getByRole('radio', { name: /problems only/i }))
    const days = screen.getByLabelText('Keep logs for')
    await userEvent.clear(days)
    await userEvent.type(days, '10')
    await userEvent.click(saveButton())
    expect(mutateAsync).toHaveBeenCalledWith({ apiLogs: { capture: 'errors_only', retentionDays: 10 } })
    expect(await screen.findByText('API log settings saved')).toBeInTheDocument()
    // Values from the response; nothing left to save.
    expect(saveButton()).toBeDisabled()
  })

  it('validates retention inline against min / max', async () => {
    renderCard()
    const days = screen.getByLabelText('Keep logs for')
    await userEvent.clear(days)
    await userEvent.type(days, '31')
    expect(screen.getByText('Must be a whole number from 1 to 30')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('shows the retention field error from a 400 under the field', async () => {
    mutateAsync.mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'Validation failed', requestId: 'abc123', errors: [{ field: 'apiLogs.retentionDays', message: 'Retention must be at most 14 days on this plan' }] },
      },
    })
    renderCard()
    const days = screen.getByLabelText('Keep logs for')
    await userEvent.clear(days)
    await userEvent.type(days, '20')
    await userEvent.click(saveButton())
    await waitFor(() => expect(screen.getByText('Retention must be at most 14 days on this plan')).toBeInTheDocument())
    expect(days).toHaveAttribute('aria-invalid', 'true')
    expect(mutateAsync).toHaveBeenCalledWith({ apiLogs: { retentionDays: 20 } })
  })
})
