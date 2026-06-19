import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { FeedPage } from './features/feed/FeedPage'
import { RecentPage } from './features/feed/RecentPage'
import { PopularPage } from './features/feed/PopularPage'
import { ExplorePage } from './features/feed/ExplorePage'
import { CategoryPage } from './features/category/CategoryPage'
import { TopicPage } from './features/topic/TopicPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

export const router = createBrowserRouter([
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
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
])
