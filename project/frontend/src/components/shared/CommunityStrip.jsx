import { COMMUNITY_ROWS, useCommunityStats } from '../../hooks/useCommunityStats'
import { formatCount } from '../../utils/formatCount'
import './CommunityStrip.css'

// Resumen de la comunidad para pantallas donde el sidebar no se muestra.
export function CommunityStrip() {
  const { data: stats } = useCommunityStats()
  if (!stats) return null

  const items = COMMUNITY_ROWS.filter(({ key }) => stats[key] > 0)
  if (items.length === 0) return null

  return (
    <div className="community-strip" aria-label="Comunidad">
      {items.map(({ key, singular, plural }) => (
        <span key={key} className="community-strip-item">
          <strong>{formatCount(stats[key])}</strong> {stats[key] === 1 ? singular : plural}
        </span>
      ))}
    </div>
  )
}
