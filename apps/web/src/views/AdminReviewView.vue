<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { apiUrl, ApiError } from '../api';
import { useSession } from '../session';

type ReviewItem = {
  id: string; title: string; description: string; location: string;
  priceAmount: number | null; currency: string | null; status: string;
  publicationStatus: 'UNPUBLISHED' | 'PUBLISHED';
  requiresMediaRecovery: boolean;
  owner: { id: string; email: string; role: 'OWNER' };
  images: { id: string; contentType: string; sizeBytes: number; position: number; url: string }[];
};
type ReviewCursor = { createdAt: string; id: string };
type ReviewPage = { items: ReviewItem[]; nextCursor: ReviewCursor | null };
type Audit = { id: string; entityType: string; entityId: string | null; listingId: string | null; action: string; reason: string | null; createdAt: string; actor: { email: string }; targetOwner: { email: string } | null };
const session = useSession();
const queue = ref<ReviewItem[]>([]), audit = ref<Audit[]>([]);
const nextCursor = ref<ReviewCursor | null>(null);
const selectedId = ref(''), reason = ref(''), busy = ref(false), loading = ref(true);
const error = ref(''), notice = ref('');
const selected = () => queue.value.find(item => item.id === selectedId.value);
async function load(append = false) {
  loading.value = true; error.value = '';
  try {
    let path = '/admin/listings/review';
    if (append && nextCursor.value) {
      const params = new URLSearchParams({ afterCreatedAt: nextCursor.value.createdAt, afterId: nextCursor.value.id });
      path += `?${params}`;
    }
    const page = await session.apiRequest<ReviewPage>(path);
    queue.value = append ? [...queue.value, ...page.items] : page.items;
    nextCursor.value = page.nextCursor;
    if (!queue.value.some(item => item.id === selectedId.value)) {
      const nextId = queue.value[0]?.id ?? '';
      if (selectedId.value !== nextId) reason.value = '';
      selectedId.value = nextId;
    }
    audit.value = await session.apiRequest<Audit[]>('/admin/listings/audit?limit=30');
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo cargar la revisión.'; }
  finally { loading.value = false; }
}
async function loadMore() { if (!loading.value && nextCursor.value) await load(true); }
function selectListing(id: string) {
  if (selectedId.value === id) return;
  selectedId.value = id;
  reason.value = '';
  error.value = '';
}
async function review(action: 'approve' | 'reject') {
  const item = selected(); if (!item || busy.value) return;
  if (action === 'reject' && reason.value.trim().length < 3) { error.value = 'Indicá un motivo de rechazo de al menos 3 caracteres.'; return; }
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await session.apiRequest(`/admin/listings/${encodeURIComponent(item.id)}/review`, {
      method: 'POST', body: JSON.stringify(action === 'reject' ? { action, reason: reason.value.trim() } : { action }),
    });
    notice.value = action === 'approve' ? 'Publicación aprobada. Queda pendiente de publicación.' : 'Publicación rechazada con motivo.';
    reason.value = ''; await load();
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 409 ? 'Otra sesión ya revisó esta publicación. Actualizá la cola.' : e instanceof Error ? e.message : 'No se pudo confirmar la revisión.';
  } finally { busy.value = false; }
}
async function publish() {
  const item = selected(); if (!item || busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await session.apiRequest(`/admin/listings/${encodeURIComponent(item.id)}/publish`, { method: 'POST' });
    notice.value = 'Publicación visible en el catálogo.'; await load();
  } catch (e) { error.value = e instanceof Error ? e.message : 'No se pudo publicar la ficha.'; }
  finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <section class="admin-review">
    <p class="eyebrow">Administración</p><h2>Revisión de publicaciones</h2>
    <p>Revisá el contenido enviado por propietarios. Solo las publicaciones aprobadas aparecen en el catálogo.</p>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="notice" role="status">{{ notice }}</p>
    <button class="secondary" :disabled="loading || busy" @click="() => load(false)">Actualizar cola</button>
    <p v-if="loading" role="status">Cargando publicaciones…</p>
    <p v-else-if="!queue.length" role="status">No hay publicaciones pendientes de revisión.</p>
    <div v-else class="admin-review-layout">
      <nav aria-label="Publicaciones pendientes">
        <button v-for="item in queue" :key="item.id" class="secondary" :disabled="busy" :aria-pressed="selectedId === item.id" @click="selectListing(item.id)">
          {{ item.title }}<small>{{ item.owner.email }}</small>
        </button>
      </nav>
      <article v-if="selected()" class="card">
        <h3>{{ selected()!.title }}</h3><p>{{ selected()!.description }}</p>
        <dl><dt>Propietario</dt><dd>{{ selected()!.owner.email }}</dd><dt>Ubicación</dt><dd>{{ selected()!.location }}</dd>
          <dt>Precio</dt><dd>{{ selected()!.priceAmount }} {{ selected()!.currency }}</dd></dl>
        <div v-if="selected()!.images.length" class="admin-review-images">
          <img v-for="image in selected()!.images" :key="image.id" :src="image.url.startsWith('/media/catalog/') ? image.url : apiUrl(image.url)" :alt="`Imagen ${image.position + 1} de ${selected()!.title}`" />
        </div><p v-else>Sin imágenes.</p>
        <p v-if="selected()!.requiresMediaRecovery" role="alert" class="error">Esta publicación conserva fotos de una carga anterior. Hay que migrarlas antes de aprobarla o publicarla.</p>
        <label for="rejection-reason">Motivo si rechazás</label><textarea id="rejection-reason" v-model="reason" maxlength="1000" rows="3" />
        <div v-if="selected()!.status === 'SUBMITTED'" class="admin-review-actions">
          <button :disabled="busy || selected()!.requiresMediaRecovery" @click="review('approve')">{{ busy ? 'Guardando…' : 'Aprobar' }}</button>
          <button class="secondary" :disabled="busy || reason.trim().length < 3" @click="review('reject')">Rechazar</button>
        </div>
        <div v-else-if="selected()!.status === 'APPROVED' && selected()!.publicationStatus === 'UNPUBLISHED'" class="admin-review-actions">
          <p>La aprobación está registrada. La ficha sigue oculta hasta que la publiques.</p>
          <button :disabled="busy || selected()!.requiresMediaRecovery" @click="publish">{{ busy ? 'Publicando…' : 'Publicar en catálogo' }}</button>
        </div>
      </article>
    </div>
    <button v-if="!loading && nextCursor" class="secondary" :disabled="busy" @click="loadMore">Cargar más publicaciones</button>
    <section class="card admin-audit"><h3>Actividad reciente</h3><ul><li v-for="entry in audit" :key="entry.id">
      {{ entry.action === 'LISTING_APPROVED' || entry.action === 'ADMIN_LISTING_APPROVED' ? 'Aprobó' : entry.action === 'LISTING_PUBLISHED' || entry.action === 'ADMIN_LISTING_PUBLISHED' ? 'Publicó' : entry.action === 'LISTING_REJECTED' || entry.action === 'ADMIN_LISTING_REJECTED' ? 'Rechazó' : entry.action }} — {{ entry.actor.email }} — {{ entry.targetOwner?.email ?? (entry.entityType + (entry.entityId ? ' ' + entry.entityId : '')) }} — {{ entry.reason ?? (entry.action === 'LISTING_PUBLISHED' || entry.action === 'ADMIN_LISTING_PUBLISHED' ? 'Publicación visible en el catálogo' : entry.action === 'LISTING_APPROVED' || entry.action === 'ADMIN_LISTING_APPROVED' ? 'Publicación aprobada' : 'Evento registrado') }}
    </li></ul><p v-if="!audit.length">Todavía no hay decisiones registradas.</p></section>
  </section>
</template>
