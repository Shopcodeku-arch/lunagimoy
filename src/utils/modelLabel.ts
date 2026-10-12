export function getModelLabel(model?: string): string {
  if (!model) return 'Luna';
  if (/coder/i.test(model)) return 'Luna Coder';
  if (/pro/i.test(model)) return 'Luna Pro';
  return 'Luna';
}
