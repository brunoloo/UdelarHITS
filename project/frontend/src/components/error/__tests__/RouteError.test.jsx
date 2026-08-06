import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { RouteError } from '../RouteError'

// Monta una ruta cuyo componente lanza `error`, con RouteError como errorElement.
// Reproduce el camino real: React Router captura el throw del render de la ruta y
// renderiza el boundary con ese error vía useRouteError().
function renderRouteThatThrows(error, queryClient) {
  function Boom() {
    throw error
  }
  const router = createMemoryRouter(
    [{ path: '/', element: <Boom />, errorElement: <RouteError /> }],
    { initialEntries: ['/'] }
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('RouteError', () => {
  let reloadMock

  beforeEach(() => {
    sessionStorage.clear()
    reloadMock = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('ante un error de chunk recarga la página (una vez) y no muestra el error duro', () => {
    const qc = new QueryClient()
    renderRouteThatThrows(
      new Error('Failed to fetch dynamically imported module: /assets/ExplorePage-abc.js'),
      qc
    )
    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Actualizando la aplicación/i)).toBeInTheDocument()
    expect(screen.queryByText(/Algo salió mal/i)).not.toBeInTheDocument()
  })

  it('ante un error NO de chunk muestra la pantalla propia y NO recarga', () => {
    const qc = new QueryClient()
    renderRouteThatThrows(new Error('Network request failed'), qc)
    expect(reloadMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Algo salió mal/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument()
  })

  it('el botón Reintentar llama a queryClient.resetQueries()', () => {
    const qc = new QueryClient()
    const resetSpy = vi.spyOn(qc, 'resetQueries')
    renderRouteThatThrows(new Error('boom cualquiera'), qc)
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }))
    expect(resetSpy).toHaveBeenCalled()
  })
})
