/**
 * Road sign brand mark, matching includes/layout.php brand().
 */
export default function Brand({ light = false }) {
  return (
    <span className={`brand${light ? ' brand-light' : ''}`}>
      <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
        <rect
          x="10"
          y="10"
          width="44"
          height="44"
          rx="6"
          transform="rotate(45 32 32)"
          fill="#F2B705"
          stroke="#23272B"
          strokeWidth="4"
        />
        <rect x="29" y="18" width="6" height="18" rx="3" fill="#23272B" />
        <circle cx="32" cy="43" r="3.5" fill="#23272B" />
      </svg>
      <span>RoadReport</span>
    </span>
  )
}
