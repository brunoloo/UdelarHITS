import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { useToast } from '../../hooks/useToast'
import { apiPost } from '../../api/client'
import './ReactionButtons.css'

/**
 * Like / Dislike buttons with optimistic updates.
 *
 * The server returns the authoritative counts after every toggle, so we
 * update the UI instantly, then reconcile with the response. If the request
 * fails we revert to the previous state.
 */
export function ReactionButtons({ contenidoId, likes, dislikes, mi_reaccion }) {
  const requireAuth = useRequireAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [state, setState] = useState({
    likes: Number(likes) || 0,
    dislikes: Number(dislikes) || 0,
    mine: mi_reaccion || null,
  })

  const mutation = useMutation({
    mutationFn: (tipo) => apiPost(`/reactions/${contenidoId}`, { tipo }),
    onSuccess: (res) => {
      const data = res?.data
      if (data) {
        setState({
          likes: Number(data.likes) || 0,
          dislikes: Number(data.dislikes) || 0,
          mine: data.mi_reaccion || null,
        })
      }
      // Invalidate every cached comment view (category/topic lists and reply
      // sublists all live under the 'replies' key) so the same comment shown
      // in more than one place reflects the new counts immediately.
      queryClient.invalidateQueries({ queryKey: ['replies'] })
    },
  })

  // Keep the local (optimistic) state in sync with the server data whenever it
  // changes: refetches after navigating, invalidations, or logging in as a
  // different user. Without this, the buttons keep their initial mount state
  // and show stale counts / mi_reaccion until a full page reload. We skip the
  // sync while a toggle is in flight so it doesn't clobber the optimistic UI.
  useEffect(() => {
    if (mutation.isPending) return
    setState({
      likes: Number(likes) || 0,
      dislikes: Number(dislikes) || 0,
      mine: mi_reaccion || null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likes, dislikes, mi_reaccion])

  function react(tipo, e) {
    e.stopPropagation()
    if (!requireAuth('Debes iniciar sesión para reaccionar')) return
    // Ignore clicks while a toggle is in flight: keeping a single request at a
    // time avoids out-of-order responses and the backend UNIQUE race that a
    // rapid double-click would otherwise trigger.
    if (mutation.isPending) return

    const prev = state

    // Compute the optimistic next state following the toggle rules.
    let likesDelta = 0
    let dislikesDelta = 0
    let nextMine

    if (prev.mine === tipo) {
      // Same reaction → toggle off
      nextMine = null
      if (tipo === 'meGusta') likesDelta = -1
      else dislikesDelta = -1
    } else if (prev.mine === null) {
      // No reaction → add
      nextMine = tipo
      if (tipo === 'meGusta') likesDelta = 1
      else dislikesDelta = 1
    } else {
      // Switching reaction
      nextMine = tipo
      if (tipo === 'meGusta') { likesDelta = 1; dislikesDelta = -1 }
      else { likesDelta = -1; dislikesDelta = 1 }
    }

    setState({
      likes: prev.likes + likesDelta,
      dislikes: prev.dislikes + dislikesDelta,
      mine: nextMine,
    })

    mutation.mutate(tipo, {
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
        className={`reaction-btn${state.mine === 'meGusta' ? ' reaction-btn--active' : ''}`}
        onClick={e => react('meGusta', e)}
        aria-pressed={state.mine === 'meGusta'}
        aria-label="Me gusta"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={state.mine === 'meGusta' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
        </svg>
        {state.likes}
      </button>
      <button
        type="button"
        className={`reaction-btn${state.mine === 'noMeGusta' ? ' reaction-btn--active reaction-btn--dislike' : ''}`}
        onClick={e => react('noMeGusta', e)}
        aria-pressed={state.mine === 'noMeGusta'}
        aria-label="No me gusta"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={state.mine === 'noMeGusta' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
        </svg>
        {state.dislikes}
      </button>
    </div>
  )
}
