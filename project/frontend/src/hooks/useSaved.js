import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useToast } from './useToast'
import { apiGet, apiPost, apiDelete } from '../api/client'

const SAVE_TOAST = {
  categoria: 'Categoría guardada',
  tema: 'Tema guardado',
  comentario: 'Comentario guardado',
}

// Hook central de "guardados". Carga una sola vez el set de ids guardados y
// expone isSaved(kind, id) + toggleSaved(kind, id). Cualquier ícono de guardado
// lee de acá, así se mantiene consistente en toda la app.
export function useSaved() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['saved', 'ids'],
    queryFn: () => apiGet('/saved/ids').then(r => r.data),
    enabled: !!user,
  })

  const sets = useMemo(() => ({
    categoria: new Set((data?.categorias || []).map(Number)),
    tema: new Set((data?.temas || []).map(Number)),
    comentario: new Set((data?.comentarios || []).map(Number)),
  }), [data])

  const isSaved = (kind, id) => sets[kind]?.has(Number(id)) ?? false

  const mutation = useMutation({
    mutationFn: ({ kind, id, saved }) =>
      saved
        ? apiDelete(`/saved/${kind}/${encodeURIComponent(id)}`)
        : apiPost('/saved', { tipo: kind, id }),
    onSuccess: (_res, { kind, saved }) => {
      queryClient.invalidateQueries({ queryKey: ['saved'] })
      showToast(saved ? 'Quitado de guardados' : (SAVE_TOAST[kind] || 'Guardado'), 'success')
    },
    onError: (err) => showToast(err.message || 'No se pudo guardar', 'error'),
  })

  const toggleSaved = (kind, id) => {
    if (!user) {
      showToast('Iniciá sesión para guardar contenido', 'error')
      return
    }
    mutation.mutate({ kind, id, saved: isSaved(kind, id) })
  }

  return { isSaved, toggleSaved, pending: mutation.isPending }
}
