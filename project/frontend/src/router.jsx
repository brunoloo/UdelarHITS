import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <div style={{ padding: '16px', color: 'var(--text-secondary)' }}>Bienvenido a UdelarHITS</div>,
      },
    ],
  },
])
