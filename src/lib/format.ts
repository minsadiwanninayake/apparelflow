const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Colombo",
});

export function formatDateTime(iso: string): string {
  return formatter.format(new Date(iso));
}