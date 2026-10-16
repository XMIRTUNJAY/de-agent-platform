/** "1 resource" not "1 resources". */
export function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

export function count(n: number, one: string, many?: string): string {
  return `${n} ${plural(n, one, many)}`;
}
