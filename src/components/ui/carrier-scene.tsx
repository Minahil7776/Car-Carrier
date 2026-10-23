/** Decorative: a car carrier on a road whose centre line keeps moving. Hidden from assistive tech. */
export function CarrierScene() {
  const cars = [0, 1, 2];
  return (
    <div aria-hidden className="relative -mx-12 -mb-12 h-56">
      <svg viewBox="0 0 560 190" className="absolute bottom-6 left-10 w-[78%] max-w-[480px]" fill="none">
        {/* trailer deck frames */}
        <path d="M120 38h316M120 92h316" stroke="rgb(255 255 255 / .35)" strokeWidth="2" />
        <path d="M120 38v70M436 38v70M278 38v70" stroke="rgb(255 255 255 / .22)" strokeWidth="2" />
        <path d="M436 92l34 34" stroke="rgb(255 255 255 / .35)" strokeWidth="2" strokeLinecap="round" />
        {/* upper deck cars */}
        {cars.map((i) => (
          <g key={`u${i}`} transform={`translate(${134 + i * 100} 14)`}>
            <path d="M0 24h82v-9l-12-9H28l-12 9L0 18z" fill={i === 1 ? "rgb(var(--beacon))" : "rgb(var(--brand))"} opacity=".95" />
            <circle cx="18" cy="26" r="5" fill="#0e1b29" /><circle cx="64" cy="26" r="5" fill="#0e1b29" />
          </g>
        ))}
        {/* lower deck cars */}
        {cars.map((i) => (
          <g key={`l${i}`} transform={`translate(${134 + i * 100} 68)`}>
            <path d="M0 24h82v-9l-12-9H28l-12 9L0 18z" fill={i === 2 ? "rgb(var(--beacon))" : "#fff"} opacity={i === 2 ? 0.95 : 0.8} />
            <circle cx="18" cy="26" r="5" fill="#0e1b29" /><circle cx="64" cy="26" r="5" fill="#0e1b29" />
          </g>
        ))}
        {/* cab */}
        <path d="M20 128V86l26-22h56v64z" fill="rgb(255 255 255 / .14)" stroke="rgb(255 255 255 / .5)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M52 72h42v26H38z" fill="rgb(255 255 255 / .25)" />
        {/* chassis + wheels */}
        <path d="M14 128h462" stroke="rgb(255 255 255 / .6)" strokeWidth="3" strokeLinecap="round" />
        {[62, 96, 340, 380, 420].map((x) => (
          <g key={x}><circle cx={x} cy="136" r="14" fill="#0e1b29" stroke="rgb(255 255 255 / .7)" strokeWidth="3" /><circle cx={x} cy="136" r="4" fill="rgb(255 255 255 / .7)" /></g>
        ))}
      </svg>
      {/* road */}
      <div className="absolute inset-x-0 bottom-0 h-7 bg-black/30" />
      <div
        className="absolute inset-x-0 bottom-3 h-[3px] animate-lane"
        style={{ backgroundImage: "linear-gradient(90deg, rgb(var(--beacon)) 0 24px, transparent 24px 48px)", backgroundSize: "48px 3px" }}
      />
    </div>
  );
}
