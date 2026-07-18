/* eslint-disable react-refresh/only-export-components --
   Módulo de configuración del router: exporta `router` (no un componente) y
   define las páginas lazy. No es un boundary de fast-refresh, así que la regla
   no aplica acá. */
import { lazy } from 'react'
import { createBrowserRouter, Link } from 'react-router-dom'
import { RootLayout } from './components/layout/RootLayout'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminRoute } from './components/auth/AdminRoute'

// Eager: FeedPage ES la ruta del Home. Cargarla lazy agregaría un round-trip de
// chunk en el arranque y empeoraría el LCP, justo lo contrario de lo buscado.
import { FeedPage } from './features/feed/FeedPage'

// Lazy: el resto de las rutas se parten en chunks propios y se bajan bajo
// demanda (code splitting). Los boundaries <Suspense> están en AppLayout (rutas
// del shell) y RootLayout (rutas standalone). Los módulos exportan componentes
// con nombre, así que se remapea a default para React.lazy.
const LoginPage = lazy(() => import('./features/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./features/auth/RegisterPage').then(m => ({ default: m.RegisterPage })))
const RecentPage = lazy(() => import('./features/feed/RecentPage').then(m => ({ default: m.RecentPage })))
const PopularPage = lazy(() => import('./features/feed/PopularPage').then(m => ({ default: m.PopularPage })))
const ExplorePage = lazy(() => import('./features/feed/ExplorePage').then(m => ({ default: m.ExplorePage })))
const CategoryPage = lazy(() => import('./features/category/CategoryPage').then(m => ({ default: m.CategoryPage })))
const TopicPage = lazy(() => import('./features/topic/TopicPage').then(m => ({ default: m.TopicPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AboutPage = lazy(() => import('./features/about/AboutPage').then(m => ({ default: m.AboutPage })))
const RulesPage = lazy(() => import('./features/about/RulesPage').then(m => ({ default: m.RulesPage })))
const ContentPoliciesPage = lazy(() => import('./features/about/ContentPoliciesPage').then(m => ({ default: m.ContentPoliciesPage })))
const ModerationPage = lazy(() => import('./features/about/ModerationPage').then(m => ({ default: m.ModerationPage })))
const RedirectPage = lazy(() => import('./features/redirect/RedirectPage').then(m => ({ default: m.RedirectPage })))
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const ChatPage = lazy(() => import('./features/chat/ChatPage').then(m => ({ default: m.ChatPage })))
const SetupProfilePage = lazy(() => import('./features/auth/SetupProfilePage').then(m => ({ default: m.SetupProfilePage })))

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1>404 — Página no encontrada</h1>
      <p>La página que buscás no existe.</p>
      <Link to="/">Volver al inicio</Link>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <FeedPage /> },
          { path: 'recent', element: <RecentPage /> },
          { path: 'popular', element: <PopularPage /> },
          { path: 'explore', element: <ExplorePage /> },
          { path: 'category/:id', element: <CategoryPage /> },
          { path: 'topic/:id', element: <TopicPage /> },
          { path: 'user/:nickname', element: <ProfilePage /> },
          {
            path: 'settings',
            element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
          },
          {
            path: 'admin',
            element: <AdminRoute><AdminPage /></AdminRoute>,
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: '/chat',
        element: <ProtectedRoute><ChatPage /></ProtectedRoute>,
      },
      {
        path: '/chat/:nickname',
        element: <ProtectedRoute><ChatPage /></ProtectedRoute>,
      },
      {
        path: '/setup-profile',
        element: <ProtectedRoute><SetupProfilePage /></ProtectedRoute>,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      { path: '/about', element: <AboutPage /> },
      { path: '/about/rules', element: <RulesPage /> },
      { path: '/about/policies', element: <ContentPoliciesPage /> },
      { path: '/about/moderation', element: <ModerationPage /> },
      { path: '/redirect', element: <RedirectPage /> },
    ],
  },
])
