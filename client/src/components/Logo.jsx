export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="memoryAllocatorMark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b7cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <g stroke="url(#memoryAllocatorMark)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M11 2.8V5.5M16 2.8V5.5M21 2.8V5.5" />
        <path d="M11 26.5v2.7M16 26.5v2.7M21 26.5v2.7" />
        <path d="M2.8 11H5.5M2.8 16H5.5M2.8 21H5.5" />
        <path d="M26.5 11h2.7M26.5 16h2.7M26.5 21h2.7" />
      </g>
      <rect x="5.5" y="5.5" width="21" height="21" rx="5.5" stroke="url(#memoryAllocatorMark)" strokeWidth="1.5" />
      <g fill="url(#memoryAllocatorMark)">
        <rect x="9" y="9" width="3.6" height="14" rx="1.6" />
        <rect x="14.2" y="14.5" width="3.6" height="8.5" rx="1.6" opacity="0.55" />
        <rect x="19.4" y="12" width="3.6" height="11" rx="1.6" />
      </g>
    </svg>
  );
}
