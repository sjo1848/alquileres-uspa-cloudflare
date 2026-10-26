/** Display positive image sizes without rounding small files down to 0 KB. */
export function formatImageSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return 'Tamaño desconocido';
  if (sizeBytes < 1024) return `${Math.trunc(sizeBytes)} bytes`;
  const kilobytes = sizeBytes / 1024;
  return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}
