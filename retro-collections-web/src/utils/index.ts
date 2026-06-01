export function getRelativeTimeString(date: Date): string {
  const timeMs = date.getTime();
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  const cutoffs = [
    60,
    3600,
    86400,
    86400 * 7,
    86400 * 30,
    86400 * 365,
    Infinity,
  ];
  const units: Intl.RelativeTimeFormatUnit[] = [
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'year',
  ];

  const unitIndex = cutoffs.findIndex(
    (cutoff) => Math.abs(deltaSeconds) < cutoff
  );
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  const value = Math.round(deltaSeconds / divisor);

  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  return rtf.format(value, units[unitIndex]);
}
