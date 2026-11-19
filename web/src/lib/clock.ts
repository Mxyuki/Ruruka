const secondsPerMinute = 60;
const secondsPerHour = 3600;

/** A time with its tenth of a second: "1:05.3", or "1:02:05.3" past an hour. */
export function formatPreciseClock(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const total = Math.floor(tenths / 10);
  const hours = Math.floor(total / secondsPerHour);
  const minutes = Math.floor((total % secondsPerHour) / secondsPerMinute);
  const rest = `${String(total % secondsPerMinute).padStart(2, '0')}.${tenths % 10}`;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** Reads what a person types as a time: "75", "75,5", "1:15" or "1:02:15.5". Null when it isn't one. */
export function parseClock(text: string): number | null {
  const parts = text.trim().replace(',', '.').split(':');
  if (parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  return parts.reduce((total, part) => total * secondsPerMinute + Number(part), 0);
}
