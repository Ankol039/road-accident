/**
 * Routes.
 *
 * Public: landing + login. Everything under /admin is wrapped in RequireAuth
 * and the staff Layout, mirroring the guard in js/app.js.
 *
 * The screens listed in HANDOFF.md that are not built yet resolve to <Pending/>,
 * a small placeholder so the navigation never dead-ends.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth.jsx'
import { ToastProvider } from './hooks/useToast.jsx'
import RequireAuth, { RedirectIfAuthed } from './components/RequireAuth.jsx'
import Layout from './components/Layout.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Reports from './pages/Reports.jsx'
import ReportDetail from './pages/ReportDetail.jsx'
import Users from './pages/Users.jsx'
import Settings from './pages/Settings.jsx'
import Audit from './pages/Audit.jsx'
import Summaries from './pages/Summaries.jsx'
import Pending from './pages/Pending.jsx'

/* Opt into the v7 behaviours early so the console stays clean. */
const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true }

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter future={ROUTER_FUTURE}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="reports" element={<Reports />} />
              <Route path="reports/:id" element={<ReportDetail />} />
              <Route path="summaries" element={<Summaries />} />
              <Route path="users" element={<Users />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit" element={<Audit />} />
              <Route path="notifications" element={<Pending title="Notifications" />} />
              <Route path="account" element={<Pending title="My account" />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
