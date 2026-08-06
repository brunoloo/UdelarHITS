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
import { RouteError } from './components/error/RouteError'

// Eager: FeedPage ES la ruta del Home. Cargarla lazy agregaría un round-trip de
// chunk en el arranque y empeoraría el LCP, justo lo contrario de lo buscado.
import { FeedPage } from './features/feed/FeedPage'

// Lazy: el resto de las rutas se parten en chunks propios y se bajan bajo
// demanda (code splitting). Los boundaries <Suspense> están en AppLayout (rutas
// del shell) y RootLayout (rutas standalone). Los módulos exportan componentes
// con nombre, así que se remapea a default para React.lazy.
//
// `lazyPage` centraliza ese remapeo y, además, blinda el caso de chunk viejo
// tras un deploy: si el hosting responde el index.html (fallback SPA) en vez del
// .js con hash viejo, el import() resuelve con un módulo SIN el export esperado.
// Sin este chequeo, `m[name]` sería undefined y React.lazy lanzaría un TypeError
// genérico ("Cannot read properties of undefined") que el errorElement NO
// reconocería como fallo de chunk. Lanzamos un mensaje que sí matchea
// isChunkLoadError para que el boundary recargue en vez de mostrar el error duro.
function lazyPage(loader, name) {
  return lazy(() =>
    loader().then((m) => {
      const Component = m[name]
      if (!Component) {
        throw new Error(`Failed to fetch dynamically imported module: ${name}`)
      }
      return { default: Component }
    })
  )
}

const LoginPage = lazyPage(() => import('./features/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyPage(() => import('./features/auth/RegisterPage'), 'RegisterPage')
const RecentPage = lazyPage(() => import('./features/feed/RecentPage'), 'RecentPage')
const PopularPage = lazyPage(() => import('./features/feed/PopularPage'), 'PopularPage')
const ExplorePage = lazyPage(() => import('./features/feed/ExplorePage'), 'ExplorePage')
const CategoryPage = lazyPage(() => import('./features/category/CategoryPage'), 'CategoryPage')
const TopicPage = lazyPage(() => import('./features/topic/TopicPage'), 'TopicPage')
const ProfilePage = lazyPage(() => import('./features/profile/ProfilePage'), 'ProfilePage')
const SettingsPage = lazyPage(() => import('./features/settings/SettingsPage'), 'SettingsPage')
const AboutPage = lazyPage(() => import('./features/about/AboutPage'), 'AboutPage')
const RulesPage = lazyPage(() => import('./features/about/RulesPage'), 'RulesPage')
const ContentPoliciesPage = lazyPage(() => import('./features/about/ContentPoliciesPage'), 'ContentPoliciesPage')
const ModerationPage = lazyPage(() => import('./features/about/ModerationPage'), 'ModerationPage')
const RedirectPage = lazyPage(() => import('./features/redirect/RedirectPage'), 'RedirectPage')
const AdminPage = lazyPage(() => import('./features/admin/AdminPage'), 'AdminPage')
const ChatPage = lazyPage(() => import('./features/chat/ChatPage'), 'ChatPage')
const SetupProfilePage = lazyPage(() => import('./features/auth/SetupProfilePage'), 'SetupProfilePage')

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
    // errorElement de nivel raíz: atrapa los errores de las rutas standalone
    // (login, chat, about, setup, redirect) que no cuelgan de AppLayout, y
    // cualquier error que no haya sido capturado por un boundary más cercano.
    errorElement: <RouteError />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          {
            // Ruta pathless sin element (React Router renderiza un <Outlet/> por
            // defecto): su único fin es dar un errorElement a TODAS las rutas del
            // shell sin repetirlo en cada una. Como el boundary vive dentro del
            // Outlet de AppLayout, la pantalla de error se pinta en el <main> y
            // conserva el shell (header/nav/sidebar) alrededor.
            errorElement: <RouteError />,
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
