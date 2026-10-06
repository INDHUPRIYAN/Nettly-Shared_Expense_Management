import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { env } from '@/lib/env'
import { ConfigErrorPage } from '@/pages/SystemPages'
import { AuthProvider } from '@/providers/AuthProvider'
import { router } from '@/routes/router'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 2 && !(error instanceof Error && error.name === 'AppError'),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

export function App() {
  const [queryClient] = useState(createQueryClient)
  if (env.missing.length > 0) return <ConfigErrorPage missing={env.missing} />
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 3500 }} />
    </QueryClientProvider>
  )
}
