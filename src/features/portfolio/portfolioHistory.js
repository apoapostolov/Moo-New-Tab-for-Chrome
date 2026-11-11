export function readHistory(stamp) {
  try {
    const stored = JSON.parse(localStorage.getItem('portfolioHistory') || 'null');
    return stored?.stamp === stamp && Array.isArray(stored.points) ? stored.points : [];
  } catch {
    return [];
  }
}
export function savePoint(stamp, updated, value) {
  const points = readHistory(stamp).filter(
    (item) => Number.isFinite(item.value) && Number.isFinite(item.time),
  );
  if (!points.some((item) => item.time === updated)) points.push({ time: updated, value });
  const trimmed = points.slice(-48);
  localStorage.setItem('portfolioHistory', JSON.stringify({ stamp, points: trimmed }));
  return trimmed;
}
