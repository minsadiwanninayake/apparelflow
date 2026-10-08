const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Sri Lanka time is UTC+05:30 all year (no daylight saving)
const COLOMBO_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Formats a date the same way on the server and in the browser,
 * e.g. "8 Oct 2026, 14:40". Avoids hydration mismatches caused by
 * different Intl/ICU versions in Node.js and Chrome.
 */
export function formatDateTime(iso: string): string {
  const utc = new Date(iso);
  const local = new Date(utc.getTime() + COLOMBO_OFFSET_MINUTES * 60_000);

  const day = local.getUTCDate();
  const month = MONTHS[local.getUTCMonth()];
  const year = local.getUTCFullYear();
  const hours = String(local.getUTCHours()).padStart(2, "0");
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}