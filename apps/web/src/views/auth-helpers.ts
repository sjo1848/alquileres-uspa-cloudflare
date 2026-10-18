export function safeLoginRedirect(value: unknown, role: 'OWNER' | 'ADMIN'): string | undefined {
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

  const path = value.split(/[?#]/, 1)[0];
  if (
    (role === 'ADMIN' && (path === '/owner' || path.startsWith('/owner/'))) ||
    (role === 'OWNER' && (path === '/admin' || path.startsWith('/admin/')))
  ) {
    return undefined;
  }

  return value;
}
