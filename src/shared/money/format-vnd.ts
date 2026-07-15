export function formatVnd(value: string | bigint): string {
  const raw = typeof value === 'bigint' ? value.toString() : value;
  if (!/^-?\d+$/.test(raw)) throw new Error('VND value must be an integer.');
  const negative = raw.startsWith('-');
  const digits = negative ? raw.slice(1) : raw;
  const groups: string[] = [];
  for (let index = digits.length; index > 0; index -= 3)
    groups.unshift(digits.slice(Math.max(0, index - 3), index));
  return `${negative ? '-' : ''}${groups.join('.')} VND`;
}
