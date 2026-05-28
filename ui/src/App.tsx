import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Legacy auth pages (still functional, wrapped in new AuthShell)
import LegacyLoginPage from './pages/auth/LoginPage'
import LegacyRegistrationPage from './pages/auth/RegistrationPage'
import LegacyRecoveryPage from './pages/auth/RecoveryPage'
import LegacyVerificationPage from './pages/auth/VerificationPage'
import LegacyErrorPage from './pages/auth/ErrorPage'
import LegacyLogoutPage from './pages/auth/LogoutPage'
import LegacyOnboardingWizard from './pages/auth/OnboardingWizard'

// New layouts
import { AuthShell } from './layouts/AuthShell'
import { AccountShell } from './layouts/AccountShell'
import { AdminShellLayout } from './layouts/AdminShell'

// New auth pages
import { LoginCodePage } from './pages/auth/LoginCodePage'
import { LoginMfaPage } from './pages/auth/LoginMfaPage'
import { FlowExpiredPage } from './pages/auth/FlowExpiredPage'
import { RegistrationInvitePage } from './pages/auth/RegistrationInvitePage'
import { RegistrationSocialConfirmPage } from './pages/auth/RegistrationSocialConfirmPage'

// New OAuth pages
import { ConsentPage } from './pages/oauth/ConsentPage'
import { DeviceFlowPage } from './pages/oauth/DeviceFlowPage'
import { OAuthLoginPage } from './pages/oauth/OAuthLoginPage'
import { PostLogoutPage } from './pages/oauth/PostLogoutPage'

// New account pages
import { ProfilePage } from './pages/account/ProfilePage'
import { SecurityPage } from './pages/account/SecurityPage'
import { AccountSessionsPage } from './pages/account/AccountSessionsPage'

// New admin pages
import { OverviewPage } from './pages/admin/OverviewPage'
import { IdentitiesPage } from './pages/admin/IdentitiesPage'
import { IdentityDetailPage } from './pages/admin/IdentityDetailPage'
import { OAuthClientsPage } from './pages/admin/OAuthClientsPage'
import { OAuthClientDetailPage } from './pages/admin/OAuthClientDetailPage'
import { JwksPage } from './pages/admin/JwksPage'
import { AdminSessionsPage } from './pages/admin/AdminSessionsPage'
import { CourierPage } from './pages/admin/CourierPage'
import { FlowsPage } from './pages/admin/FlowsPage'
import { SchemasPage } from './pages/admin/SchemasPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* ─── Public auth flows ─── */}
          <Route element={<AuthShell />}>
            {/* Legacy flows — still functional */}
            <Route path="/login" element={<LegacyLoginPage />} />
            <Route path="/registration" element={<LegacyRegistrationPage />} />
            <Route path="/recovery" element={<LegacyRecoveryPage />} />
            <Route path="/verification" element={<LegacyVerificationPage />} />
            <Route path="/error" element={<LegacyErrorPage />} />
            <Route path="/logout" element={<LegacyLogoutPage />} />
            <Route path="/onboarding" element={<LegacyOnboardingWizard />} />

            {/* New flow variants */}
            <Route path="/auth/login/code" element={<LoginCodePage />} />
            <Route path="/auth/login/mfa" element={<LoginMfaPage />} />
            <Route path="/auth/flow-expired" element={<FlowExpiredPage />} />
            <Route path="/auth/register/invite" element={<RegistrationInvitePage />} />
            <Route path="/auth/register/social-confirm" element={<RegistrationSocialConfirmPage />} />

            {/* OAuth / Hydra flows */}
            <Route path="/consent" element={<ConsentPage />} />
            <Route path="/oauth/device" element={<DeviceFlowPage />} />
            <Route path="/oauth/login" element={<OAuthLoginPage />} />
            <Route path="/oauth/logged-out" element={<PostLogoutPage />} />
          </Route>

          {/* ─── Account settings ─── */}
          <Route element={<AccountShell />}>
            <Route path="/account" element={<Navigate to="/account/profile" replace />} />
            <Route path="/account/profile" element={<ProfilePage />} />
            <Route path="/account/security" element={<SecurityPage />} />
            <Route path="/account/sessions" element={<AccountSessionsPage />} />
            {/* Legacy redirects */}
            <Route path="/profile" element={<Navigate to="/account/profile" replace />} />
            <Route path="/security" element={<Navigate to="/account/security" replace />} />
          </Route>

          {/* ─── Admin dashboard ─── */}
          <Route element={<AdminShellLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="/admin/overview" element={<OverviewPage />} />
            <Route path="/admin/identities" element={<IdentitiesPage />} />
            <Route path="/admin/identities/:id" element={<IdentityDetailPage />} />
            <Route path="/admin/clients" element={<OAuthClientsPage />} />
            <Route path="/admin/clients/:id" element={<OAuthClientDetailPage />} />
            <Route path="/admin/jwks" element={<JwksPage />} />
            <Route path="/admin/sessions" element={<AdminSessionsPage />} />
            <Route path="/admin/courier" element={<CourierPage />} />
            <Route path="/admin/flows" element={<FlowsPage />} />
            <Route path="/admin/schemas" element={<SchemasPage />} />
            {/* Legacy redirects */}
            <Route path="/identities" element={<Navigate to="/admin/identities" replace />} />
            <Route path="/identities/:id" element={<Navigate to="/admin/identities/:id" replace />} />
            <Route path="/sessions" element={<Navigate to="/admin/sessions" replace />} />
            <Route path="/courier" element={<Navigate to="/admin/courier" replace />} />
            <Route path="/schemas" element={<Navigate to="/admin/schemas" replace />} />
            <Route path="/settings" element={<Navigate to="/account/profile" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
