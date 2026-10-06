import { createBrowserRouter } from 'react-router'
import { FullPageSpinner } from '@/components/common/States'
import { LandingPage } from '@/pages/LandingPage'
import { NotFoundPage, RouteErrorPage } from '@/pages/SystemPages'
import { ProtectedRoute, PublicOnlyRoute } from './guards'

/* Pages are code-split per route so phones download only what they need. */

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      { path: '/', element: <LandingPage /> },
      // Public: invite previews work while logged out; joining requires login.
      { path: '/join/:inviteToken', lazy: () => import('@/pages/JoinGroupPage').then((m) => ({ Component: m.JoinGroupPage })) },
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/login', lazy: () => import('@/pages/AuthPages').then((m) => ({ Component: m.LoginPage })) },
          { path: '/signup', lazy: () => import('@/pages/AuthPages').then((m) => ({ Component: m.SignupPage })) },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/dashboard', lazy: () => import('@/pages/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
          { path: '/profile', lazy: () => import('@/pages/ProfilePage').then((m) => ({ Component: m.ProfilePage })) },
          {
            path: '/groups/:groupId',
            lazy: () => import('@/components/layout/GroupLayout').then((m) => ({ Component: m.GroupLayout })),
            children: [
              { index: true, lazy: () => import('@/pages/GroupPage').then((m) => ({ Component: m.GroupPage })) },
              { path: 'expenses', lazy: () => import('@/pages/ExpensesPage').then((m) => ({ Component: m.ExpensesPage })) },
              { path: 'settlements', lazy: () => import('@/pages/SettlementsPage').then((m) => ({ Component: m.SettlementsPage })) },
              { path: 'members', lazy: () => import('@/pages/MembersPage').then((m) => ({ Component: m.MembersPage })) },
              { path: 'settings', lazy: () => import('@/pages/GroupSettingsPage').then((m) => ({ Component: m.GroupSettingsPage })) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
