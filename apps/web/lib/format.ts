export function bdt(poysha: number) { return `৳${(poysha / 100).toFixed(2)}`; }
export function label(value: string) { return value.replaceAll('_', ' '); }
