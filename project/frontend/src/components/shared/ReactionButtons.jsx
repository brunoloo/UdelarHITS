import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { useToast } from '../../hooks/useToast'
import { apiPost } from '../../api/client'
import { formatCount } from '../../utils/formatCount'
import './ReactionButtons.css'

/**
 * Like button with optimistic updates.
 *
 * The server returns the authoritative count after every toggle, so we update
 * the UI instantly, then reconcile with the response. If the request fails we
 * revert to the previous state.
 */
export function ReactionButtons({ contenidoId, likes, mi_reaccion }) {
  const requireAuth = useRequireAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [state, setState] = useState({
    likes: Number(likes) || 0,
    mine: mi_reaccion === 'meGusta',
  })

  const mutation = useMutation({
    mutationFn: () => apiPost(`/reactions/${contenidoId}`, { tipo: 'meGusta' }),
    onSuccess: (res) => {
      const data = res?.data
      if (data) {
        setState({
          likes: Number(data.likes) || 0,
          mine: data.mi_reaccion === 'meGusta',
        })
      }
      // Invalidate every cached comment view (category/topic lists and reply
      // sublists all live under the 'replies' key) so the same comment shown
      // in more than one place reflects the new count immediately. Also refresh
      // the notification badge: a like notifies the comment author.
      queryClient.invalidateQueries({ queryKey: ['replies'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Keep the local (optimistic) state in sync with the server data whenever it
  // changes: refetches after navigating, invalidations, or logging in as a
  // different user. Without this, the button keeps its initial mount state and
  // shows a stale count / mi_reaccion until a full page reload. We skip the
  // sync while a toggle is in flight so it doesn't clobber the optimistic UI.
  useEffect(() => {
    if (mutation.isPending) return
    setState({
      likes: Number(likes) || 0,
      mine: mi_reaccion === 'meGusta',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likes, mi_reaccion])

  function handleClick(e) {
    e.stopPropagation()
    if (!requireAuth('Debes iniciar sesión para reaccionar')) return
    // Ignore clicks while a toggle is in flight: keeping a single request at a
    // time avoids out-of-order responses and the backend UNIQUE race that a
    // rapid double-click would otherwise trigger.
    if (mutation.isPending) return

    const prev = state

    // Optimistic toggle: like on/off.
    setState({
      likes: prev.likes + (prev.mine ? -1 : 1),
      mine: !prev.mine,
    })

    mutation.mutate(undefined, {
      onError: (err) => {
        setState(prev) // revert
        showToast(err.message || 'No se pudo registrar la reacción', 'error')
      },
    })
  }

  return (
    <div className="reaction-buttons">
      <button
        type="button"
        className={`reaction-btn${state.mine ? ' reaction-btn--active' : ''}`}
        onClick={handleClick}
        aria-pressed={state.mine}
        aria-label="Me gusta"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={state.mine ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
        <span title={`${state.likes} me gusta`}>{formatCount(state.likes)}</span>
      </button>
    </div>
  )
}
