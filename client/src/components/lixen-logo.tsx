type Props = { className?: string };

export default function LixenLogo({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 36"
      fill="none"
      aria-label="Lixen Prospecting Agent OS"
    >
      <g>
        <rect x="0" y="6" width="6" height="24" rx="1.5" fill="currentColor" />
        <rect x="10" y="14" width="6" height="16" rx="1.5" fill="currentColor" />
        <rect x="20" y="2" width="6" height="28" rx="1.5" fill="currentColor" opacity="0.85" />
        <circle cx="13" cy="9" r="2" fill="currentColor" />
      </g>
      <text
        x="36"
        y="24"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="16"
        fontWeight="700"
        letterSpacing="-0.01em"
        fill="currentColor"
      >
        Lixen
      </text>
      <text
        x="84"
        y="24"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="13"
        fontWeight="500"
        letterSpacing="0.01em"
        fill="currentColor"
        opacity="0.75"
      >
        Prospecting OS
      </text>
    </svg>
  );
}
