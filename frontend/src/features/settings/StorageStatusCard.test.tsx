import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const get = vi.fn()
vi.mock('@/lib/axios', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import StorageStatusCard from './StorageStatusCard'

const show = (data: unknown) => {
  get.mockResolvedValue({ data: { data } })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StorageStatusCard />
    </QueryClientProvider>
  )
}

describe('StorageStatusCard', () => {
  beforeEach(() => get.mockReset())

  it('shows a connected S3 bucket', async () => {
    show({ kind: 's3', bucket: 'velox-crm-docs', region: 'ap-south-1', prefix: 'crm/', signedUrlTtlSeconds: 300, ok: true, error: null, durable: true, warning: null })
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('velox-crm-docs')).toBeInTheDocument()
    expect(screen.getByText(/expire after 5 minutes/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('warns when documents are on the server disk in production', async () => {
    show({ kind: 'local', directory: '/app/uploads', ok: true, error: null, durable: false, warning: 'Documents are being saved on the server\'s own disk. Set S3_BUCKET to store them in S3.' })
    expect(await screen.findByText('Local disk')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Set S3_BUCKET')
  })

  it('shows the reason when S3 is not reachable', async () => {
    show({ kind: 's3', bucket: 'velox-crm-docs', region: 'us-east-1', ok: false, error: 'Access denied (AccessDenied). Check the access key / secret, and that the IAM policy allows this bucket.', durable: true, warning: null })
    expect(await screen.findByText('Not working')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
  })
})
