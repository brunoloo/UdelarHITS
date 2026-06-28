import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { router } from './router'
import './components/ui/Toast.css'

const queryClient = new QueryClient()

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
