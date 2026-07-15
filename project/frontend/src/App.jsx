import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { router } from './router'
import './components/ui/Toast.css'

// Defaults de performance: con staleTime 0 (default de TanStack) TODA query se
// re-fetchea en cada mount y en cada focus de la ventana. En un foro, 1 minuto
// de frescura por defecto hace la navegación instantánea desde cache (se
// revalida en background) sin mostrar datos viejos de verdad. Las queries que
// necesitan otra cosa lo declaran por su cuenta (etiquetas: 5 min; contadores
// de no-leídos: 0).
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
          <ThemeProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </ThemeProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
