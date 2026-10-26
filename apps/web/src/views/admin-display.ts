const ADMIN_TIME_ZONE = 'America/Argentina/Mendoza';
const ADMIN_LOCALE = 'es-AR';

export function formatAdminTimestamp(value: string | null | undefined, timeZone = ADMIN_TIME_ZONE) {
  if (!value) return 'Sin confirmación registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin confirmación registrada';
  return new Intl.DateTimeFormat(ADMIN_LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).format(date);
}

export function formatAdminPrice(amount: number | null | undefined, currency: string | null | undefined, period: string | null | undefined) {
  if (amount === null || amount === undefined || !currency) return 'Precio no informado';
  const formatted = `${new Intl.NumberFormat(ADMIN_LOCALE, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
  const cadence = period === 'WEEK' ? 'semana' : period === 'MONTH' ? 'mes' : null;
  return cadence ? `${formatted} / ${cadence}` : formatted;
}

export function adminDurationLabel(value: string | null | undefined) {
  return ({ WEEKS: 'Por semanas', MONTHS: 'Por meses', PERMANENT: 'Permanente', FLEXIBLE: 'Flexible' } as Record<string, string>)[value ?? ''] ?? 'Duración no informada';
}

export function adminActionLabel(action: string) {
  const labels: Record<string, string> = {
    LISTING_APPROVED: 'Aprobó la publicación',
    ADMIN_LISTING_APPROVED: 'Aprobó la publicación',
    LISTING_REJECTED: 'Rechazó la publicación',
    ADMIN_LISTING_REJECTED: 'Rechazó la publicación',
    LISTING_PUBLISHED: 'Publicó en el catálogo',
    ADMIN_LISTING_PUBLISHED: 'Publicó en el catálogo',
    ADMIN_ASSISTED_LISTING_CREATED: 'Creó un borrador asistido',
    ADMIN_ASSISTED_LISTING_UPDATED: 'Editó los datos del borrador',
    ADMIN_ASSISTED_AVAILABILITY_UPDATED: 'Actualizó la disponibilidad',
    ADMIN_ASSISTED_LISTING_RECONFIRMED: 'Reconfirmó la disponibilidad',
    ADMIN_ASSISTED_LISTING_SUBMITTED: 'Envió el borrador a revisión',
    ADMIN_ASSISTED_LISTING_DELETED: 'Eliminó el borrador asistido',
  };
  return labels[action] ?? `Evento registrado: ${action}`;
}
