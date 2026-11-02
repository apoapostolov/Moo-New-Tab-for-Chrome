export const MiB = 1024 * 1024;
export function slope(values) {
  if (values.length < 2) return 0;
  const meanX = (values.length - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return numerator / denominator;
}

export function assessMemory(
  samples,
  { maxResidentMiB = 3072, maxGrowthMiB = 96, maxSlopeMiB = 12 } = {},
) {
  const errors = [];
  if (
    !samples.length ||
    samples.some(
      (sample) =>
        !Number.isFinite(sample.resident) ||
        sample.resident <= 0 ||
        !Number.isFinite(sample.explicit) ||
        sample.explicit <= 0,
    )
  ) {
    return {
      errors: ['Missing or invalid Gecko memory measurements'],
      growthMiB: null,
      slopeMiB: null,
      peakResidentMiB: null,
    };
  }
  const peakResidentMiB = Math.max(...samples.map((sample) => sample.resident)) / MiB;
  if (peakResidentMiB > maxResidentMiB)
    errors.push(`Resident memory ${peakResidentMiB.toFixed(1)} MiB exceeds ${maxResidentMiB} MiB`);
  // Compare only equivalent, warmed, post-minimization checkpoints. Active samples
  // record playback peaks but must not be mixed with retired decoder measurements.
  const settled = samples.filter((sample) => sample.settled).map((sample) => sample.explicit / MiB);
  const growthMiB = settled.length > 1 ? settled.at(-1) - settled[0] : 0;
  const slopeMiB = slope(settled);
  if (settled.length < 3) errors.push('At least three settled memory checkpoints are required');
  if (growthMiB > maxGrowthMiB)
    errors.push(`Settled explicit growth ${growthMiB.toFixed(1)} MiB exceeds ${maxGrowthMiB} MiB`);
  if (slopeMiB > maxSlopeMiB)
    errors.push(
      `Settled explicit slope ${slopeMiB.toFixed(1)} MiB/checkpoint exceeds ${maxSlopeMiB}`,
    );
  return { errors, growthMiB, slopeMiB, peakResidentMiB };
}

export function resourceErrors(snapshot, baseline) {
  const errors = [];
  for (const key of ['players', 'objectURLs', 'videos', 'overlays', 'retiredVideosWithSource']) {
    if (snapshot[key] !== 0) errors.push(`${key}: ${snapshot[key]} resources remain after unmount`);
  }
  if (snapshot.listeners !== baseline.listeners)
    errors.push(`EventBus listeners grew from ${baseline.listeners} to ${snapshot.listeners}`);
  if (snapshot.createdPlayers !== snapshot.destroyedPlayers)
    errors.push('HLS create/destroy counts differ');
  if (snapshot.errors.length)
    errors.push(...snapshot.errors.map((error) => `Uncaught browser error: ${error}`));
  return errors;
}
