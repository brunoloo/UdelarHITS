import './seasonal.css'

// Calabaza 24x24 en dos modos:
//  - like (default): monocromo con currentColor, mismo contrato que el pulgar
//    (contorno si no hay like, relleno si `filled`). Hereda el color del botón.
//  - decorative: a color, con los tokens --season-pumpkin* vía clases de
//    seasonal.css (nada de colores en el SVG). Se usa en el logo del Header.
// Siempre aria-hidden: el significado lo da el contenedor (aria-label del
// botón) o es pura decoración.
const BODY = 'M12 6.5c-1.2-.8-3-.9-4.6-.3C4.5 7.2 3 9.8 3 13.5S5 21 8.5 21c1.4 0 2.5-.4 3.5-1 1 .6 2.1 1 3.5 1 3.5 0 5.5-3.8 5.5-7.5s-1.5-6.3-4.4-7.3c-1.6-.6-3.4-.5-4.6.3z'
const RIB_LEFT = 'M12 6.5c-1.8 2-2.5 4.8-2.5 7.5s.8 4.8 2.5 6'
const RIB_RIGHT = 'M12 6.5c1.8 2 2.5 4.8 2.5 7.5s-.8 4.8-2.5 6'
const STEM = 'M12 6.5V4.2c0-.9.6-1.6 1.6-1.9'

export function PumpkinIcon({ filled = false, decorative = false, size = 24, className }) {
  const classes = ['pumpkin-icon', decorative && 'pumpkin-icon--decorative', className]
    .filter(Boolean)
    .join(' ')

  if (decorative) {
    return (
      <svg
        className={classes}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path className="pumpkin-body" d={BODY} />
        <path className="pumpkin-rib" d={RIB_LEFT} fill="none" />
        <path className="pumpkin-rib" d={RIB_RIGHT} fill="none" />
        <path className="pumpkin-stem" d={STEM} fill="none" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path className="pumpkin-body" d={BODY} fill={filled ? 'currentColor' : 'none'} />
      <path d={RIB_LEFT} />
      <path d={RIB_RIGHT} />
      <path d={STEM} />
    </svg>
  )
}
