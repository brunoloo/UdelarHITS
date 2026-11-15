import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { apiGet, apiPost, apiDelete } from '../api/client'
import { trackSaveContent } from '../utils/analytics'

const SAVE_TOAST = {
  categoria: 'Categoría guardada',
  tema: 'Tema guardado',
  comentario: 'Comentario guardado',
}

// Carga una sola vez los ids guardados; todos los íconos de guardado leen de acá.
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
      // `saved` es el estado previo: solo se registra el evento al guardar.
      if (!saved) trackSaveContent(kind)
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
