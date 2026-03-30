/** Convert an ISO hour_bucket like "2026-03-30T14:00:00Z" to local time "HH:MM" */
export function formatHourLabel(hourBucket: string): string {
  const d = new Date(hourBucket);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
