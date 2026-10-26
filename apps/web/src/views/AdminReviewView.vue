<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { apiUrl, ApiError } from '../api';
import { useSession } from '../session';
import { adminActionLabel, adminDurationLabel, formatAdminPrice, formatAdminTimestamp } from './admin-display';

type ReviewItem = {
  id: string; title: string; description: string; location: string;
  priceAmount: number | null; pricePeriod: string | null; currency: string | null;
  rentalDuration: string | null; maxOccupants: number | null;
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | null; lastConfirmedAt: string | null;
  createdAt: string; updatedAt: string; rejectionReason: string | null;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  publicationStatus: 'UNPUBLISHED' | 'PUBLISHED'; requiresMediaRecovery: boolean;
  owner: { id: string; email: string; role: 'OWNER' };
  images: { id: string; contentType: string; sizeBytes: number; position: number; url: string }[];
};
type ReviewCursor = { createdAt: string; id: string };
type ReviewPage = { items: ReviewItem[]; nextCursor: ReviewCursor | null };
type Audit = { id: string; entityType: string; entityId: string | null; listingId: string | null; action: string; reason: string | null; createdAt: string; actor: { email: string }; targetOwner: { email: string } | null };

const session = useSession();
const queue = ref<ReviewItem[]>([]), audit = ref<Audit[]>([]);
const nextCursor = ref<ReviewCursor | null>(null);
const selectedId = ref(''), reason = ref(''), busy = ref(false), loading = ref(true), auditLoading = ref(false);
const error = ref(''), auditError = ref(''), notice = ref(''), compact = ref(false), mobileDetailOpen = ref(false);
const queueButtonRefs = new Map<string, HTMLButtonElement>();
let mediaQuery: MediaQueryList | null = null;
let requestGeneration = 0;
const selected = computed(() => queue.value.find(item => item.id === selectedId.value) ?? null);
const submittedCount = computed(() => queue.value.filter(item => item.status === 'SUBMITTED').length);
const publishCount = computed(() => queue.value.filter(item => item.status === 'APPROVED' && item.publicationStatus === 'UNPUBLISHED').length);
const incompleteFields = computed(() => {
  const item = selected.value;
  if (!item) return [];
  return [
    ['precio', item.priceAmount], ['moneda', item.currency], ['periodicidad', item.pricePeriod],
    ['duración', item.rentalDuration], ['capacidad', item.maxOccupants],
  ].filter(([, value]) => value === null || value === undefined || value === '').map(([label]) => label as string);
});
function setCompact() { compact.value = mediaQuery?.matches ?? window.matchMedia('(max-width: 48rem)').matches; }
function setQueueButtonRef(id: string, element: Element | null) {
  if (element instanceof HTMLButtonElement) queueButtonRefs.set(id, element);
  else queueButtonRefs.delete(id);
}
async function loadAudit() {
  auditLoading.value = true; auditError.value = '';
  try { audit.value = await session.apiRequest<Audit[]>('/admin/listings/audit?limit=30'); }
  catch (e) { auditError.value = e instanceof Error ? e.message : 'No se pudo cargar la actividad.'; }
  finally { auditLoading.value = false; }
}
async function load(append = false) {
  const generation = ++requestGeneration;
  loading.value = true; error.value = '';
  try {
    let path = '/admin/listings/review';
    if (append && nextCursor.value) {
      const params = new URLSearchParams({ afterCreatedAt: nextCursor.value.createdAt, afterId: nextCursor.value.id });
      path += `?${params}`;
    }
    const page = await session.apiRequest<ReviewPage>(path);
    if (generation !== requestGeneration) return;
    queue.value = append ? [...queue.value, ...page.items.filter(item => !queue.value.some(existing => existing.id === item.id))] : page.items;
    nextCursor.value = page.nextCursor;
    if (!queue.value.some(item => item.id === selectedId.value)) {
      selectedId.value = !compact.value ? queue.value[0]?.id ?? '' : '';
      reason.value = ''; mobileDetailOpen.value = false;
    } else if (!selectedId.value && !compact.value) selectedId.value = queue.value[0]?.id ?? '';
  } catch (e) {
    if (generation === requestGeneration) error.value = e instanceof Error ? e.message : 'No se pudo cargar la cola.';
  } finally {
    if (generation === requestGeneration) loading.value = false;
  }
}
async function refresh() { await Promise.all([load(false), loadAudit()]); }
async function loadMore() { if (!loading.value && nextCursor.value) await load(true); }
function selectListing(id: string) {
  if (busy.value) return;
  if (compact.value) mobileDetailOpen.value = true;
  if (id === selectedId.value) return;
  selectedId.value = id; reason.value = ''; error.value = ''; notice.value = '';
}
async function backToQueue() {
  mobileDetailOpen.value = false;
  await nextTick();
  queueButtonRefs.get(selectedId.value)?.focus({ preventScroll: true });
}
async function review(action: 'approve' | 'reject') {
  const item = selected.value; if (!item || busy.value) return;
  if (action === 'reject' && reason.value.trim().length < 3) { error.value = 'Escribí un motivo de rechazo de al menos 3 caracteres.'; return; }
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await session.apiRequest(`/admin/listings/${encodeURIComponent(item.id)}/review`, {
      method: 'POST', body: JSON.stringify(action === 'reject' ? { action, reason: reason.value.trim() } : { action }),
    });
    notice.value = action === 'approve' ? 'Revisión aprobada. La publicación sigue oculta hasta que la publiques.' : 'Publicación rechazada con el motivo registrado.';
    reason.value = '';
    await Promise.all([load(false), loadAudit()]);
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 409
      ? 'La publicación cambió mientras la revisabas. Actualizá la cola antes de decidir.'
      : e instanceof Error ? e.message : 'No se pudo confirmar la revisión.';
  } finally { busy.value = false; }
}
async function publish() {
  const item = selected.value; if (!item || busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await session.apiRequest(`/admin/listings/${encodeURIComponent(item.id)}/publish`, { method: 'POST' });
    notice.value = 'La publicación ya está visible en el catálogo.';
    await Promise.all([load(false), loadAudit()]);
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 409
      ? 'Esta publicación ya cambió de estado. Actualizá la cola.'
      : e instanceof Error ? e.message : 'No se pudo publicar la ficha.';
  } finally { busy.value = false; }
}
function statusLabel(item: ReviewItem) {
  return item.status === 'SUBMITTED' ? 'En revisión' : item.publicationStatus === 'PUBLISHED' ? 'Publicada' : 'Aprobada · sin publicar';
}
function statusClass(item: ReviewItem) {
  return item.status === 'SUBMITTED' ? 'is-review' : item.publicationStatus === 'PUBLISHED' ? 'is-published' : 'is-approved';
}
function imageSrc(url: string) { return url.startsWith('/media/catalog/') ? url : apiUrl(url); }
onMounted(() => { mediaQuery = window.matchMedia('(max-width: 48rem)'); setCompact(); mediaQuery.addEventListener('change', setCompact); void Promise.all([load(), loadAudit()]); });
onBeforeUnmount(() => mediaQuery?.removeEventListener('change', setCompact));
</script>

<template>
  <section class="admin-workspace admin-moderation" aria-labelledby="admin-review-title">
    <header class="admin-page-heading">
      <div><p class="admin-eyebrow">Administración <span>·</span> moderación</p><h1 id="admin-review-title">Revisión de publicaciones</h1><p>Revisá cada alojamiento y registrá una decisión informada.</p></div>
      <button class="admin-button admin-button-secondary admin-refresh" type="button" :disabled="loading || busy" @click="refresh">{{ loading ? 'Actualizando…' : 'Actualizar cola' }}</button>
    </header>
    <div class="admin-metrics" aria-label="Resumen de la cola">
      <div><span>En revisión</span><strong>{{ submittedCount }}</strong></div>
      <div><span>Aprobadas · sin publicar</span><strong>{{ publishCount }}</strong></div>
      <p>La aprobación y la publicación son pasos distintos.</p>
    </div>
    <p v-if="notice" class="admin-feedback is-success" role="status">{{ notice }}</p>
    <p v-if="error" class="admin-feedback is-error" role="alert">{{ error }} <button v-if="error.includes('Actualizá')" type="button" class="admin-inline-button" :disabled="loading || busy" @click="load(false)">Actualizar cola</button></p>

    <div class="admin-moderation-layout">
      <aside class="admin-queue-panel" :class="{ 'is-mobile-hidden': compact && mobileDetailOpen }" aria-labelledby="admin-queue-title">
        <header class="admin-panel-heading"><div><p class="admin-eyebrow">Bandeja de decisiones</p><h2 id="admin-queue-title">Alojamientos pendientes</h2></div><span class="admin-count">{{ queue.length }}</span></header>
        <p v-if="loading && !queue.length" class="admin-panel-state" role="status">Cargando publicaciones…</p>
        <div v-else-if="error && !queue.length" class="admin-panel-state"><p>No pudimos cargar la bandeja.</p><button type="button" class="admin-button admin-button-secondary" @click="load(false)">Reintentar</button></div>
        <p v-else-if="!queue.length" class="admin-empty-state" role="status"><strong>Todo al día</strong><span>No hay publicaciones pendientes de revisión.</span></p>
        <nav v-else class="admin-queue-list" aria-label="Alojamientos pendientes de moderación">
          <button v-for="item in queue" :key="item.id" :ref="element => setQueueButtonRef(item.id, element as Element | null)" class="admin-queue-item" :class="{ 'is-selected': selectedId === item.id }" type="button" :disabled="busy" :aria-pressed="selectedId === item.id" @click="selectListing(item.id)">
            <span class="admin-queue-item-top"><span class="admin-status-pill" :class="statusClass(item)">{{ statusLabel(item) }}</span><span v-if="item.requiresMediaRecovery" class="admin-warning-dot" aria-label="Fotos requieren revisión">!</span></span>
            <strong>{{ item.title || 'Alojamiento sin título' }}</strong>
            <span class="admin-queue-owner">{{ item.owner.email }}</span>
            <span class="admin-queue-meta">{{ item.location || 'Ubicación no informada' }}</span>
            <span class="admin-queue-price">{{ formatAdminPrice(item.priceAmount, item.currency, item.pricePeriod) }}</span>
          </button>
        </nav>
        <button v-if="nextCursor" class="admin-button admin-button-secondary admin-load-more" type="button" :disabled="loading || busy" @click="loadMore">{{ loading ? 'Cargando…' : 'Cargar más publicaciones' }}</button>
      </aside>

      <article class="admin-detail-panel" :class="{ 'is-mobile-hidden': compact && !mobileDetailOpen }" aria-labelledby="admin-detail-title">
        <template v-if="selected">
          <button v-if="compact" class="admin-back-button" type="button" @click="backToQueue">← Volver a la lista</button>
          <header class="admin-detail-heading">
            <div><p class="admin-eyebrow">Detalle para decisión</p><h2 id="admin-detail-title">{{ selected.title || 'Alojamiento sin título' }}</h2></div>
            <span class="admin-status-pill" :class="statusClass(selected)">{{ statusLabel(selected) }}</span>
          </header>
          <div class="admin-owner-line"><span class="admin-avatar" aria-hidden="true">{{ selected.owner.email.slice(0, 1).toUpperCase() }}</span><span><small>Publicado por</small><strong>{{ selected.owner.email }}</strong></span></div>
          <section class="admin-property-facts" aria-label="Información de la publicación">
            <div><span>Ubicación</span><strong>{{ selected.location || 'No informada' }}</strong></div>
            <div><span>Precio</span><strong>{{ formatAdminPrice(selected.priceAmount, selected.currency, selected.pricePeriod) }}</strong></div>
            <div><span>Estadía</span><strong>{{ adminDurationLabel(selected.rentalDuration) }}</strong></div>
            <div><span>Capacidad</span><strong>{{ selected.maxOccupants ? `Hasta ${selected.maxOccupants} personas` : 'No informada' }}</strong></div>
            <div><span>Disponibilidad declarada</span><strong>{{ selected.availabilityStatus === 'AVAILABLE' ? 'Disponible' : selected.availabilityStatus === 'UNAVAILABLE' ? 'No disponible' : 'No informada' }}</strong></div>
            <div><span>Última confirmación</span><strong>{{ formatAdminTimestamp(selected.lastConfirmedAt) }} <small>· hora de Mendoza</small></strong></div>
          </section>
          <section v-if="incompleteFields.length" class="admin-data-warning" aria-label="Datos no informados">
            <strong>Información pendiente</strong><span>La ficha no informa: {{ incompleteFields.join(', ') }}.</span>
          </section>
          <section v-if="selected.rejectionReason" class="admin-rejection-note"><strong>Motivo del rechazo anterior</strong><p>{{ selected.rejectionReason }}</p></section>
          <section class="admin-review-copy"><h3>Descripción</h3><p>{{ selected.description || 'Sin descripción.' }}</p></section>
          <section class="admin-review-photo-section" aria-labelledby="admin-review-photos-title">
            <header><div><p class="admin-eyebrow">Material enviado</p><h3 id="admin-review-photos-title">Fotografías</h3></div><span class="admin-count">{{ selected.images.length }}</span></header>
            <div v-if="selected.images.length" class="admin-review-images">
              <figure v-for="image in selected.images" :key="image.id"><img :src="imageSrc(image.url)" :alt="`Fotografía ${image.position + 1} de ${selected.title}`" /><figcaption>Foto {{ image.position + 1 }} · {{ Math.round(image.sizeBytes / 1024) }} KB</figcaption></figure>
            </div>
            <p v-else class="admin-muted-note">El propietario no adjuntó fotografías.</p>
            <p v-if="selected.requiresMediaRecovery" class="admin-feedback is-error" role="alert">Hay registros de imágenes anteriores que requieren recuperación. No se puede aprobar ni publicar hasta resolverlos.</p>
          </section>
          <section v-if="selected.status === 'SUBMITTED'" class="admin-decision-box" aria-label="Decisión de moderación">
            <label class="admin-field" for="admin-rejection-reason"><span>Motivo del rechazo <small>(obligatorio para rechazar)</small></span><textarea id="admin-rejection-reason" v-model="reason" maxlength="1000" rows="3" :aria-invalid="reason.trim().length > 0 && reason.trim().length < 3" /></label>
            <div class="admin-decision-actions"><button class="admin-button admin-button-primary" type="button" :disabled="busy || selected.requiresMediaRecovery" @click="review('approve')">{{ busy ? 'Guardando…' : 'Aprobar revisión' }}</button><button class="admin-button admin-button-danger" type="button" :disabled="busy || reason.trim().length < 3" @click="review('reject')">Rechazar con motivo</button></div>
            <p class="admin-muted-note">Aprobar registra la revisión. La publicación seguirá oculta hasta que elijas publicarla.</p>
          </section>
          <section v-else-if="selected.status === 'APPROVED' && selected.publicationStatus === 'UNPUBLISHED'" class="admin-decision-box">
            <p class="admin-approved-message"><strong>Revisión aprobada.</strong> Todavía no está visible en el catálogo.</p>
            <button class="admin-button admin-button-primary" type="button" :disabled="busy || selected.requiresMediaRecovery" @click="publish">{{ busy ? 'Publicando…' : 'Publicar en catálogo' }}</button>
          </section>
          <section v-else class="admin-decision-box"><p class="admin-approved-message">Esta publicación ya está publicada. Las acciones disponibles dependen de su estado actual.</p></section>
        </template>
        <div v-else class="admin-detail-empty" role="status"><span aria-hidden="true">⌕</span><strong>Elegí una publicación</strong><p>El detalle mostrará la información necesaria para revisar y decidir.</p></div>
      </article>
    </div>

    <section class="admin-audit-panel" aria-labelledby="admin-audit-title">
      <header class="admin-panel-heading"><div><p class="admin-eyebrow">Trazabilidad</p><h2 id="admin-audit-title">Actividad reciente</h2></div><button class="admin-inline-button" type="button" :disabled="auditLoading" @click="loadAudit">{{ auditLoading ? 'Actualizando…' : 'Actualizar actividad' }}</button></header>
      <p v-if="auditError" class="admin-feedback is-error" role="alert">{{ auditError }} <button class="admin-inline-button" type="button" @click="loadAudit">Reintentar</button></p>
      <p v-else-if="auditLoading && !audit.length" role="status" class="admin-muted-note">Cargando actividad…</p>
      <p v-else-if="!audit.length" class="admin-muted-note">Todavía no hay decisiones registradas.</p>
      <ol v-else class="admin-audit-list"><li v-for="entry in audit" :key="entry.id"><span class="admin-audit-mark" aria-hidden="true">✓</span><div><strong>{{ adminActionLabel(entry.action) }}</strong><p>{{ entry.actor.email }}<template v-if="entry.targetOwner"> · alojamiento de {{ entry.targetOwner.email }}</template></p><p v-if="entry.reason" class="admin-audit-reason">{{ entry.reason }}</p></div><time :datetime="entry.createdAt">{{ formatAdminTimestamp(entry.createdAt) }} · Mendoza</time></li></ol>
    </section>
  </section>
</template>
