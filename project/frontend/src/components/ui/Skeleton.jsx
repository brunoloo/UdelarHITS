import './Skeleton.css'

export function Skeleton({ width, height, borderRadius, style, ...props }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, ...style }}
      {...props}
    />
  )
}
