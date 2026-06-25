// Ícono de "fijar" (chincheta). `filled` lo muestra con relleno (fijado) o solo
// el contorno.
export function PinIcon({ filled = false, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.5-3V6a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v8z" />
    </svg>
  )
}
