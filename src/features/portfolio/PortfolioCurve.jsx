import { uiText } from 'lib/translations';
const trendClass = (amount) => (amount > 0 ? 'positive' : amount < 0 ? 'negative' : '');
export default function Curve({ points, change }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const positions = values.map((value, index) => [
    (index / (values.length - 1)) * 300,
    46 - ((value - low) / span) * 38,
  ]);
  let path = `M ${positions[0][0]} ${positions[0][1]}`;
  for (let i = 1; i < positions.length - 1; i += 1) {
    const [x, y] = positions[i];
    const [nextX, nextY] = positions[i + 1];
    path += ` Q ${x} ${y} ${(x + nextX) / 2} ${(y + nextY) / 2}`;
  }
  const [lastX, lastY] = positions[positions.length - 1];
  path += ` L ${lastX} ${lastY}`;
  return (
    <svg
      className={`portfolioCurve ${trendClass(change)}`}
      viewBox="0 0 300 54"
      preserveAspectRatio="none"
      role="img"
      aria-label={uiText('portfolio_recorded_history')}
    >
      <path d={path} />
    </svg>
  );
}
