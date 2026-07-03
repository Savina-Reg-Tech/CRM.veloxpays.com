import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleGuard from '@/routes/RoleGuard'
import VerificationGate from '@/routes/VerificationGate'
import AppLayout from '@/components/layout/AppLayout'
import AuthLayout from '@/components/layout/AuthLayout'
import LoginPage from '@/features/auth/pages/LoginPage'
import SuperAdminDashboard from '@/features/dashboard/super-admin/SuperAdminDashboard'
import EmployeeDashboard from '@/features/dashboard/employee/EmployeeDashboard'
import EmployeesPage from '@/features/employees/pages/EmployeesPage'
import SettingsPage from '@/features/settings/pages/SettingsPage'
import CustomersPage from '@/features/customers/pages/CustomersPage'
import ApprovalsPage from '@/features/approvals/pages/ApprovalsPage'
import VerificationDashboardPage from '@/features/verification/pages/VerificationDashboardPage'
import VerificationReviewPage from '@/features/verification/pages/VerificationReviewPage'
import DashboardRedirect from './DashboardRedirect'
// Form Builder
import FormsListPage from '@/features/forms/pages/FormsListPage'
import FormBuilderPage from '@/features/forms/pages/FormBuilderPage'
import FormSubmissionsPage from '@/features/forms/pages/FormSubmissionsPage'
import FormAnalyticsPage from '@/features/forms/pages/FormAnalyticsPage'
import SpamLeadsPage from '@/features/forms/pages/SpamLeadsPage'
import BlockedDomainsPage from '@/features/forms/pages/BlockedDomainsPage'
import PublicFormPage from '@/features/forms/pages/PublicFormPage'
// VeloxVerse Admin
import VVAnalyticsPage from '@/features/veloxverse-admin/pages/VVAnalyticsPage'
import VVEsimListPage from '@/features/veloxverse-admin/pages/VVEsimListPage'
import VVEsimDetailPage from '@/features/veloxverse-admin/pages/VVEsimDetailPage'
import VVLoungePage from '@/features/veloxverse-admin/pages/VVLoungePage'
import VVTransfersPage from '@/features/veloxverse-admin/pages/VVTransfersPage'
import VVPromoCodesPage from '@/features/veloxverse-admin/pages/VVPromoCodesPage'
import VVPricingPage from '@/features/veloxverse-admin/pages/VVPricingPage'
import VVUsersListPage from '@/features/veloxverse-admin/pages/VVUsersListPage'
import VVUserDetailPage from '@/features/veloxverse-admin/pages/VVUserDetailPage'
import VVSupportListPage from '@/features/veloxverse-admin/pages/VVSupportListPage'
import VVSupportDetailPage from '@/features/veloxverse-admin/pages/VVSupportDetailPage'
import VVSettingsPage from '@/features/veloxverse-admin/pages/VVSettingsPage'
import VVPointsPage from '@/features/veloxverse-admin/pages/VVPointsPage'
import VVClubPage from '@/features/veloxverse-admin/pages/VVClubPage'

const router = createBrowserRouter([
  // ── Public ──────────────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },

  // ── Public embed form (no auth, no layout) ───────────────────────
  { path: '/embed/:id', element: <PublicFormPage /> },

  // ── Authenticated ────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            // Confines unverified employees/agents/affiliates to the
            // Verification Dashboard until their account is activated.
            element: <VerificationGate />,
            children: [
          // Smart role-based redirect
          { path: '/dashboard', element: <DashboardRedirect /> },

          // Super Admin routes
          {
            element: <RoleGuard allowedRoles={['super_admin', 'admin']} />,
            children: [
              { path: '/dashboard/admin',               element: <SuperAdminDashboard /> },
              { path: '/dashboard/settings',            element: <SettingsPage /> },
              { path: '/dashboard/verification-review', element: <VerificationReviewPage /> },
              // ── Form Builder ──────────────────────────────────────
              { path: '/dashboard/forms',                        element: <FormsListPage /> },
              { path: '/dashboard/forms/builder/:id',            element: <FormBuilderPage /> },
              { path: '/dashboard/forms/submissions/:id',        element: <FormSubmissionsPage /> },
              { path: '/dashboard/forms/analytics/:id',          element: <FormAnalyticsPage /> },
              { path: '/dashboard/forms/leads',                  element: <SpamLeadsPage /> },
              { path: '/dashboard/forms/spam',                   element: <SpamLeadsPage /> },
              { path: '/dashboard/forms/blocked-domains',        element: <BlockedDomainsPage /> },
              // ── VeloxVerse Admin ────────────────────────────────────
              { path: '/dashboard/veloxverse/analytics',              element: <VVAnalyticsPage /> },
              { path: '/dashboard/veloxverse/esim-orders',            element: <VVEsimListPage /> },
              { path: '/dashboard/veloxverse/esim-orders/:orderNo',   element: <VVEsimDetailPage /> },
              { path: '/dashboard/veloxverse/lounge',                 element: <VVLoungePage /> },
              { path: '/dashboard/veloxverse/transfers',              element: <VVTransfersPage /> },
              { path: '/dashboard/veloxverse/promo-codes',            element: <VVPromoCodesPage /> },
              { path: '/dashboard/veloxverse/pricing',                element: <VVPricingPage /> },
              { path: '/dashboard/veloxverse/users',                  element: <VVUsersListPage /> },
              { path: '/dashboard/veloxverse/users/:id',              element: <VVUserDetailPage /> },
              { path: '/dashboard/veloxverse/support',                element: <VVSupportListPage /> },
              { path: '/dashboard/veloxverse/support/:ticketId',      element: <VVSupportDetailPage /> },
              { path: '/dashboard/veloxverse/settings',               element: <VVSettingsPage /> },
              { path: '/dashboard/veloxverse/points',                 element: <VVPointsPage /> },
              { path: '/dashboard/veloxverse/club',                  element: <VVClubPage /> },
            ],
          },

          // Backward-compat redirect: /dashboard/velox-esim → /dashboard/customers
          { path: '/dashboard/velox-esim', element: <Navigate to="/dashboard/customers" replace /> },

          // User management route for creator roles
          {
            element: <RoleGuard allowedRoles={['super_admin', 'admin', 'employee']} />,
            children: [{ path: '/dashboard/employees', element: <EmployeesPage /> }],
          },

          {
            element: <RoleGuard allowedRoles={['super_admin', 'admin', 'employee', 'agent', 'affiliate']} />,
            children: [
              { path: '/dashboard/customers', element: <CustomersPage /> },
              { path: '/dashboard/approvals', element: <ApprovalsPage /> },
            ],
          },

          // Verification dashboard for users who must complete KYC.
          {
            element: <RoleGuard allowedRoles={['employee', 'agent', 'affiliate']} />,
            children: [
              { path: '/dashboard/verification', element: <VerificationDashboardPage /> },
              { path: '/dashboard/me', element: <EmployeeDashboard /> },
            ],
          },
            ],
          },

          // ──────────────────────────────────────────────────────────
          // FUTURE ROLES — add here, zero structural changes needed
          // {
          //   element: <RoleGuard allowedRoles={['affiliate']} />,
          //   children: [{ path: '/dashboard/affiliate', element: <AffiliateDashboard /> }],
          // },
          // ──────────────────────────────────────────────────────────
        ],
      },
    ],
  },

  // ── Catch-all ────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/login" replace /> },
])

export default function Router() {
  return <RouterProvider router={router} />
}
