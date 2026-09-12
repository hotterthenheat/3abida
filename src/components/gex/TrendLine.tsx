/** Tiny trend line for hover cards — colored by direction of travel. */
const TrendLine = ({ points }: { points: number[] }) => {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pts = points
    .map((v, i) => `${((i / (points.length - 1)) * 100).toFixed(1)},${(26 - ((v - min) / span) * 22 - 2).toFixed(1)}`)
    .join(' ');
  const rising = points[points.length - 1] >= points[0];
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="w-full h-7">
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? 'rgb(var(--bull))' : 'rgb(var(--bear))'}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default TrendLine;
