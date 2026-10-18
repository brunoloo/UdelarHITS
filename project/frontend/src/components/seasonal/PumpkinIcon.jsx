import './seasonal.css'

// Calabaza decorativa 24x24 (jack-o'-lantern) del logo del Header. A color,
// con los tokens --season-pumpkin* vía clases de seasonal.css (nada de
// colores en el SVG). Pura decoración: aria-hidden.
const BODY = 'M12 6.5c-1.2-.8-3-.9-4.6-.3C4.5 7.2 3 9.8 3 13.5S5 21 8.5 21c1.4 0 2.5-.4 3.5-1 1 .6 2.1 1 3.5 1 3.5 0 5.5-3.8 5.5-7.5s-1.5-6.3-4.4-7.3c-1.6-.6-3.4-.5-4.6.3z'
const STEM = 'M12 6.5V4.2c0-.9.6-1.6 1.6-1.9'

// Los gajos se cortan arriba para no cruzarse con los ojos y la boca.
const RIB_LEFT_SHORT = 'M12 6.5c-1.2 1-1.9 2.2-2.2 3.4'
const RIB_RIGHT_SHORT = 'M12 6.5c1.2 1 1.9 2.2 2.2 3.4'
const EYE_LEFT = 'M7.2 12.9h2.9L8.65 10.3z'
const EYE_RIGHT = 'M13.9 12.9h2.9l-1.45-2.6z'
const NOSE = 'M11.1 14.8h1.8L12 13.4z'
const MOUTH = 'M6.4 15.4l1.9.8.9-.8 1.2 1 1.6-.8 1.6.8 1.2-1 .9.8 1.9-.8c-.9 2.9-3 4.1-5.6 4.1s-4.7-1.2-5.6-4.1z'

export function PumpkinIcon({ size = 24, className }) {
  const classes = ['pumpkin-icon', 'pumpkin-icon--decorative', className].filter(Boolean).join(' ')

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
      <path className="pumpkin-rib" d={RIB_LEFT_SHORT} fill="none" />
      <path className="pumpkin-rib" d={RIB_RIGHT_SHORT} fill="none" />
      <path className="pumpkin-stem" d={STEM} fill="none" strokeWidth="2" />
      <path className="pumpkin-face" d={EYE_LEFT} />
      <path className="pumpkin-face" d={EYE_RIGHT} />
      <path className="pumpkin-face" d={NOSE} />
      <path className="pumpkin-face" d={MOUTH} />
    </svg>
  )
}
