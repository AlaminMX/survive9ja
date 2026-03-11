const CertificateBadge = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 120 120" className={className} aria-label="Certificate of Survival badge">
    <defs>
      <path id="textCircle" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0" />
    </defs>
    <circle cx="60" cy="60" r="56" fill="none" stroke="hsl(42,62%,55%)" strokeWidth="2.5" />
    <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(42,62%,55%)" strokeWidth="1" />
    <text fontSize="8" fontWeight="700" fill="hsl(42,62%,55%)" fontFamily="Sora, sans-serif" letterSpacing="2">
      <textPath href="#textCircle" startOffset="15%">CERTIFICATE OF SURVIVAL</textPath>
    </text>
    <text x="60" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="hsl(150,82%,23%)" fontFamily="Sora, sans-serif">
      SURVIVE
    </text>
    <text x="60" y="68" textAnchor="middle" fontSize="9" fontWeight="700" fill="hsl(150,82%,23%)" fontFamily="Sora, sans-serif">
      NIGERIA
    </text>
    <text x="60" y="80" textAnchor="middle" fontSize="6" fill="hsl(42,62%,55%)" fontFamily="DM Sans, sans-serif">
      #survive9ja
    </text>
  </svg>
);

export default CertificateBadge;
