<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { ApiError, publicListingPath, request } from '../api';
import { useSavedSelection } from '../use-saved-selection';
import { availabilityLabel, formatConfirmationDate, freshnessLabel, type AvailabilityStatus, type FreshnessStatus } from './availability-helpers';
import type { Currency, PricePeriod, RentalDuration } from './rental-domain';

type Listing = {
  id: string; title: string; location: string; priceAmount: number | null; pricePeriod: PricePeriod | null;
  currency: Currency | null; maxOccupants: number | null; rentalDuration: RentalDuration | null;
  depositStatus: 'NOT_INFORMED'|'ASK_OWNER'|'NOT_REQUIRED'|'FIXED_AMOUNT'|null;
  depositAmount: number|null; depositCurrency: Currency|null;
  internetIncluded: 'INCLUDED'|'NOT_INCLUDED'|'NOT_INFORMED'|null;
  waterIncluded: 'INCLUDED'|'NOT_INCLUDED'|'NOT_INFORMED'|null;
  electricityIncluded: 'INCLUDED'|'NOT_INCLUDED'|'NOT_INFORMED'|null;
  gasIncluded: 'INCLUDED'|'NOT_INCLUDED'|'NOT_INFORMED'|null;
  petsPolicy: 'ALLOWED'|'NOT_ALLOWED'|'ASK_OWNER'|'NOT_INFORMED'|null;
  availableFrom: string|null; availabilityStatus: AvailabilityStatus; lastConfirmedAt: string|null;
  freshnessStatus: FreshnessStatus;
};
type Row = { id: string; state: 'loading'|'ready'|'missing'|'error'; listing?: Listing };

const selection = useSavedSelection();
const rows = ref<Row[]>([]);
const refreshing = ref(false);
const refreshError = ref('');
let generation = 0;

const currentListings = computed(() => rows.value.filter((row): row is Row & { listing: Listing } => row.state === 'ready' && Boolean(row.listing)));
const comparable = computed(() => currentListings.value.filter(row => row.listing.pricePeriod === 'MONTH'));
const outOfScope = computed(() => currentListings.value.filter(row => row.listing.pricePeriod !== 'MONTH'));
const selectionHasErrors = computed(() => rows.value.some(row => row.state === 'error'));

async function refresh() {
  const currentGeneration = ++generation;
  const ids = [...selection.ids.value];
  rows.value = ids.map(id => ({ id, state: 'loading' }));
  refreshing.value = true;
  refreshError.value = '';
  try {
    const resolved = await Promise.all(ids.map(async id => {
      try {
        const listing = await request<Listing>(publicListingPath(id), { cache: 'no-store' });
        return { id, state: 'ready' as const, listing };
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) return { id, state: 'missing' as const };
        return { id, state: 'error' as const };
      }
    }));
    if (currentGeneration !== generation) return;
    rows.value = resolved;
    if (resolved.some(row => row.state === 'error')) refreshError.value = 'No pudimos actualizar uno o más alojamientos. Reintentá para comparar información vigente.';
  } finally {
    if (currentGeneration === generation) refreshing.value = false;
  }
}

function remove(id: string) { selection.remove(id); }
function retry() { void refresh(); }
function detail(id: string) { return `/listings/${encodeURIComponent(id)}`; }
function contact(id: string) { return { path: detail(id), hash: '#contact-form' }; }

function formatPrice(listing: Listing) {
  if (listing.priceAmount === null || !listing.currency || listing.pricePeriod !== 'MONTH') return 'No informado';
  return `${listing.currency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(listing.priceAmount)} por mes`;
}
function capacity(listing: Listing) {
  if (!listing.maxOccupants) return 'No informado';
  return `${listing.maxOccupants} ${listing.maxOccupants === 1 ? 'persona' : 'personas'}`;
}
function deposit(listing: Listing) {
  if (listing.depositStatus === 'ASK_OWNER') return 'A consultar';
  if (listing.depositStatus === 'NOT_REQUIRED') return 'No se requiere';
  if (listing.depositStatus === 'FIXED_AMOUNT' && listing.depositAmount && listing.depositCurrency) {
    return `${listing.depositCurrency} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(listing.depositAmount)} · declarado`;
  }
  return 'No informado';
}
function included(value: Listing['internetIncluded']) {
  if (value === 'INCLUDED') return 'Incluido';
  if (value === 'NOT_INCLUDED') return 'No incluido';
  return 'No informado';
}
function pets(value: Listing['petsPolicy']) {
  if (value === 'ALLOWED') return 'Permitidas';
  if (value === 'NOT_ALLOWED') return 'No permitidas';
  if (value === 'ASK_OWNER') return 'A consultar';
  return 'No informado';
}
function estimatedMoveIn(value: string|null) {
  if (!value) return 'No informado';
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? 'No informado' : new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

watch(() => [...selection.ids.value], () => { void refresh(); }, { immediate: true });
function onVisibility() { if (document.visibilityState === 'visible' && selection.ids.value.length) void refresh(); }
onMounted(() => document.addEventListener('visibilitychange', onVisibility));
onBeforeUnmount(() => { generation++; document.removeEventListener('visibilitychange', onVisibility); });
</script>

<template>
  <section class="selection-page" aria-labelledby="selection-title" :aria-busy="refreshing">
    <header class="selection-heading">
      <div><p class="eyebrow">Tu búsqueda, a tu ritmo</p><h1 id="selection-title">Mi selección</h1><p>Guardá opciones y compará sus condiciones mensuales.</p></div>
      <span class="selection-count" aria-live="polite">{{ selection.count.value }} de {{ selection.max }} guardados</span>
    </header>

    <p class="selection-disclaimer"><strong>Guardar no reserva.</strong> La disponibilidad y las condiciones son declaraciones del propietario; confirmalas antes de avanzar. Guardar tampoco envía una consulta.</p>
    <p v-if="selection.storageError.value" class="selection-feedback error" role="alert">No pudimos guardar esta selección en el dispositivo. Revisá el almacenamiento del navegador e intentá otra vez.</p>
    <p v-if="refreshError" class="selection-feedback error" role="alert">{{ refreshError }} <button class="secondary" type="button" :disabled="refreshing" @click="retry">Reintentar</button></p>

    <div v-if="!selection.ids.value.length" class="selection-empty" role="status">
      <span class="selection-empty-icon" aria-hidden="true">☆</span><p class="eyebrow">Empezá por guardar</p>
      <h2>Tu próxima comparación empieza acá.</h2><p>Guardá hasta cuatro alquileres mensuales desde el catálogo. Solo guardamos sus identificadores en este navegador.</p>
      <RouterLink class="selection-primary-link" :to="{ path: '/', query: { pricePeriod: 'MONTH' } }">Explorar alquileres mensuales <span aria-hidden="true">→</span></RouterLink>
    </div>

    <template v-else>
      <div class="selection-toolbar">
        <div><h2>Compará las opciones guardadas</h2><p v-if="comparable.length < 2">Agregá {{ 2 - comparable.length }} {{ comparable.length === 1 ? 'alquiler mensual' : 'alquileres mensuales' }} más para comparar.</p><p v-else>{{ comparable.length }} alquileres mensuales con información actualizada de sus fichas públicas.</p></div>
        <button class="secondary" type="button" :disabled="refreshing" @click="retry">{{ refreshing ? 'Actualizando…' : 'Actualizar datos' }}</button>
      </div>

      <div class="selection-grid" :class="{ 'selection-grid-comparing': comparable.length >= 2 }" aria-label="Alojamientos guardados">
        <article v-for="row in rows" :key="row.id" class="selection-card" :class="{ 'selection-card-stale': row.state === 'missing' || outOfScope.some(item => item.id === row.id) }">
          <template v-if="row.state === 'loading'"><div class="selection-card-state" role="status"><span class="loading-mark" aria-hidden="true"></span><p>Cargando información vigente…</p></div></template>
          <template v-else-if="row.state === 'error'"><div class="selection-card-state"><p class="eyebrow">No actualizado</p><h3>Este alojamiento</h3><p>No pudimos consultar su ficha. Reintentá; los datos guardados no sustituyen la información pública actual.</p><button class="secondary" type="button" @click="retry">Reintentar</button></div></template>
          <template v-else-if="row.state === 'missing'"><div class="selection-card-state"><span class="selection-unavailable-icon" aria-hidden="true">—</span><p class="eyebrow">Ya no está en el catálogo</p><h3>Anuncio no disponible</h3><p>Puede haber sido retirado o despublicado. No podemos confirmar cuál de esos cambios ocurrió.</p><button class="selection-remove" type="button" @click="remove(row.id)">Quitar de mi selección</button></div></template>
          <template v-else-if="row.listing">
            <div class="selection-card-heading"><div><p class="eyebrow">{{ row.listing.location || 'Ubicación no informada' }}</p><h3><RouterLink :to="detail(row.id)">{{ row.listing.title }}</RouterLink></h3></div><button class="icon-remove" type="button" :aria-label="`Quitar ${row.listing.title} de mi selección`" @click="remove(row.id)">×</button></div>
            <p v-if="row.listing.pricePeriod !== 'MONTH'" class="selection-card-warning" role="status">Este anuncio ya no tiene precio mensual publicado y no se incluye en la comparación. Podés quitarlo de tu selección.</p>
            <template v-else>
              <p v-if="row.listing.availabilityStatus === 'UNAVAILABLE'" class="selection-card-warning" role="status">El propietario declaró este alojamiento como no disponible.</p>
              <p class="selection-price">{{ formatPrice(row.listing) }}</p>
              <dl class="selection-facts">
                <div><dt>Personas</dt><dd>{{ capacity(row.listing) }}</dd></div>
                <div><dt>Ubicación</dt><dd>{{ row.listing.location || 'No informado' }}</dd></div>
                <div><dt>Depósito / garantía</dt><dd>{{ deposit(row.listing) }}</dd></div>
                <div><dt>Internet</dt><dd>{{ included(row.listing.internetIncluded) }}</dd></div>
                <div><dt>Agua</dt><dd>{{ included(row.listing.waterIncluded) }}</dd></div>
                <div><dt>Electricidad</dt><dd>{{ included(row.listing.electricityIncluded) }}</dd></div>
                <div><dt>Gas</dt><dd>{{ included(row.listing.gasIncluded) }}</dd></div>
                <div><dt>Mascotas</dt><dd>{{ pets(row.listing.petsPolicy) }}</dd></div>
                <div><dt>Ingreso estimado</dt><dd>{{ estimatedMoveIn(row.listing.availableFrom) }}</dd></div>
                <div class="selection-availability"><dt>Disponibilidad</dt><dd>{{ availabilityLabel(row.listing.availabilityStatus, row.listing.freshnessStatus) }}</dd><small>{{ freshnessLabel(row.listing.freshnessStatus, row.listing.lastConfirmedAt) }} · {{ formatConfirmationDate(row.listing.lastConfirmedAt) }}</small></div>
              </dl>
              <div class="selection-card-actions"><RouterLink :to="detail(row.id)">Ver ficha</RouterLink><RouterLink :aria-label="`Consultar por ${row.listing.title}`" :to="contact(row.id)">Consultar</RouterLink></div>
            </template>
          </template>
        </article>
      </div>

      <p v-if="selectionHasErrors" class="selection-footnote">La comparación muestra solo datos confirmados en esta carga. Actualizá antes de decidir.</p>
      <RouterLink class="selection-back-link" :to="{ path: '/', query: { pricePeriod: 'MONTH' } }">← Seguir explorando alquileres mensuales</RouterLink>
    </template>
  </section>
</template>
