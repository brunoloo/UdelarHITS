import { useSeason } from '../../hooks/useSeason'
import './seasonal.css'

// Telaraña de esquina (ancla arriba a la izquierda): hilos radiales desde la
// esquina + arcos concéntricos. stroke currentColor → el color y la opacidad
// los pone .seasonal-decor con los tokens --season-web*.
function CornerWeb({ className }) {
  return (
    <svg
      className={`seasonal-decor-web ${className}`}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      focusable="false"
    >
      {/* radiales */}
      <path d="M0 0L100 0M0 0L96 40M0 0L72 72M0 0L40 96M0 0L0 100" />
      {/* arcos (de adentro hacia afuera), levemente caídos entre hilos */}
      <path d="M20 0Q18 6 19 8Q14 12 14 14Q10 16 8 19Q6 18 0 20" />
      <path d="M42 0Q38 12 39 16Q30 26 30 30Q24 32 16 39Q12 38 0 42" />
      <path d="M66 0Q60 18 61 25Q48 42 47 47Q40 50 25 61Q18 60 0 66" />
      <path d="M90 0Q82 26 83 34Q66 58 65 65Q56 68 34 83Q26 82 0 90" />
    </svg>
  )
}

// Decoración de fondo según la temporada activa. Puramente visual: capa fija,
// sin eventos, oculta a lectores de pantalla. Sin temporada no renderiza nada.
export function SeasonalDecor() {
  const season = useSeason()

  switch (season) {
    case 'halloween':
      return (
        <div className="seasonal-decor" aria-hidden="true">
          <CornerWeb className="seasonal-decor-web--top" />
          <CornerWeb className="seasonal-decor-web--bottom" />
        </div>
      )
    default:
      return null
  }
}
