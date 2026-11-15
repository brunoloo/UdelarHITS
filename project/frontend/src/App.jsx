import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { SeasonProvider } from './context/SeasonContext'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { PushProvider } from './context/PushContext'
import { router } from './router'
import './components/ui/Toast.css'

// Un minuto de frescura por defecto: la navegación sale de caché y se revalida en segundo
// plano. Las queries que necesitan otro valor lo declaran.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          {/* Necesita el usuario: va dentro de AuthProvider. */}
          <PushProvider>
            <ThemeProvider>
              <SeasonProvider>
                <ToastProvider>
                  <RouterProvider router={router} />
                </ToastProvider>
              </SeasonProvider>
            </ThemeProvider>
          </PushProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
