export function safeLoginRedirect(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/auth/') ||
    value.split(/[?#]/, 1)[0] === '/login' ||
    value.includes('\\')
  ) {
    return undefined;
  }

  return value;
}
