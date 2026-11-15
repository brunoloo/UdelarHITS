import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '../api/client'
import { buildReplyFormData } from '../utils/attachments'
import { useToast } from './useToast'

// Responder a un comentario desde un listado: publica y refresca la query del listado.
// Devuelve la función con la firma que espera CommentCard.onReply.
export function useQuickReply(invalidateKey) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const mutation = useMutation({
    mutationFn: ({ parentId, cuerpo, files, poll }) =>
      apiPost('/replies/create', buildReplyFormData({ cuerpo, comentario_padre_id: parentId }, files, poll)),
    onSuccess: (res) => {
      if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
      else showToast('Respuesta publicada', 'success')
      queryClient.invalidateQueries({ queryKey: invalidateKey })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  return (parentId, text, files, poll) =>
    mutation.mutateAsync({ parentId, cuerpo: text, files, poll })
}
