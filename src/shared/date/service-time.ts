export const serviceTimeZone = 'Asia/Ho_Chi_Minh';

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: serviceTimeZone,
});

const dateInputFormatter = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  month: '2-digit',
  timeZone: serviceTimeZone,
  year: 'numeric',
});

export function formatServiceDateTime(value: string | Date): string {
  return dateTimeFormatter.format(
    typeof value === 'string' ? new Date(value) : value,
  );
}

export function toServiceDate(value: string | Date): string {
  const parts = Object.fromEntries(
    dateInputFormatter
      .formatToParts(typeof value === 'string' ? new Date(value) : value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
