<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiUrl, ApiError, request } from '../api';
import {
  availabilityLabel,
  formatConfirmationDate,
  freshnessLabel,
  freshnessMarker,
  type AvailabilityStatus,
  type FreshnessStatus,
} from './availability-helpers';
import {
  hasRentalDomainData,
  pricePeriodOptions,
  pricePeriodLabel,
  rentalDurationOptions,
  rentalDurationLabel,
  type Currency,
  type PricePeriod,
  type RentalDuration,
} from './rental-domain';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string;
  priceAmount: number | null;
  pricePeriod: PricePeriod | null;
  rentalDuration: RentalDuration | null;
  maxOccupants: number | null;
  currency: Currency | null;
  domainDataStatus: 'COMPLETE' | 'MISSING';
  images: { id: string; contentType: string; url?: string }[];
  availabilityStatus: AvailabilityStatus;
  lastConfirmedAt: string | null;
  freshnessStatus: FreshnessStatus;
};
type Page = { items: Listing[]; page: number; pageSize: number; totalItems: number; totalPages: number };
const route = useRoute();
const router = useRouter();
const filters = reactive({
  location: '', minPriceAmount: '', maxPriceAmount: '', currency: '' as Currency | '',
  pricePeriod: '' as PricePeriod | '', rentalDuration: '' as RentalDuration | '',
  maxOccupants: '', soloDisponibles: false,
});
const advancedOpen = ref(false);
const page = ref<Page | null>(null);
const loading = ref(false);
const error = ref('');
const failedImages = ref(new Set<string>());
const pageSize = 6;
let requestSequence = 0;
let activeRequest: AbortController | undefined;

const activeFilterCount = computed(() => [
  filters.minPriceAmount, filters.maxPriceAmount, filters.currency, filters.pricePeriod,
  filters.rentalDuration, filters.maxOccupants, filters.soloDisponibles ? 'true' : '',
].filter(Boolean).length);
const resultsTitle = computed(() => filters.pricePeriod === 'MONTH'
  ? 'Alquileres con precio mensual'
  : filters.pricePeriod === 'WEEK'
    ? 'Alquileres con precio semanal'
    : 'Todos los alquileres publicados');
const pageFromRoute = () => Math.max(1, Math.min(10_000, Number(route.query.page ?? 1) || 1));

function routeValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function syncFiltersFromRoute() {
  filters.location = routeValue(route.query.location);
  filters.minPriceAmount = routeValue(route.query.minPriceAmount);
  filters.maxPriceAmount = routeValue(route.query.maxPriceAmount);
  filters.currency = routeValue(route.query.currency) as Currency | '';
  filters.pricePeriod = routeValue(route.query.pricePeriod) as PricePeriod | '';
  filters.rentalDuration = routeValue(route.query.rentalDuration) as RentalDuration | '';
  filters.maxOccupants = routeValue(route.query.maxOccupants);
  filters.soloDisponibles = route.query.availableOnly === 'true';
  advancedOpen.value = activeFilterCount.value > 0 && !(activeFilterCount.value === 1 && filters.pricePeriod === 'MONTH');
}

function paramsForPage(pageNumber: number) {
  const values: Record<string, string> = {
    location: filters.location.trim(), minPriceAmount: filters.minPriceAmount,
    maxPriceAmount: filters.maxPriceAmount, currency: filters.currency,
    pricePeriod: filters.pricePeriod, rentalDuration: filters.rentalDuration,
    maxOccupants: filters.maxOccupants,
    availableOnly: filters.soloDisponibles ? 'true' : '', page: String(pageNumber), pageSize: String(pageSize),
  };
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== '' && !(key === 'page' && value === '1')));
}

async function loadPage(pageNumber = pageFromRoute()) {
  const sequence = ++requestSequence;
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  loading.value = true;
  error.value = '';
  const params = new URLSearchParams(paramsForPage(pageNumber));
  try {
    const result = await request<Page>(`/public/listings?${params}`, { signal: controller.signal });
    if (sequence !== requestSequence) return;
    const lastPage = Math.max(1, result.totalPages);
    if (pageNumber > lastPage) {
      const query = { ...route.query };
      if (lastPage === 1) delete query.page;
      else query.page = String(lastPage);
      await router.replace({ path: '/', query });
      return;
    }
    page.value = result;
    failedImages.value = new Set();
  } catch (cause) {
    if (sequence !== requestSequence || controller.signal.aborted) return;
    error.value = cause instanceof ApiError ? cause.message : 'No pudimos cargar los alojamientos.';
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

async function navigateToResults(pageNumber = 1) {
  const query = paramsForPage(pageNumber);
  const current = new URLSearchParams(Object.entries(route.query).flatMap(([key, value]) =>
    typeof value === 'string' ? [[key, value]] : [],
  ));
  const next = new URLSearchParams(query);
  if (current.toString() === next.toString()) {
    await loadPage(pageNumber);
    return;
  }
  await router.push({ path: '/', query });
}

function resetFilters() {
  filters.location = '';
  filters.minPriceAmount = '';
  filters.maxPriceAmount = '';
  filters.currency = '';
  filters.pricePeriod = '';
  filters.rentalDuration = '';
  filters.maxOccupants = '';
  filters.soloDisponibles = false;
  advancedOpen.value = false;
  void navigateToResults(1);
}

function searchMonthly() {
  filters.pricePeriod = 'MONTH';
  void navigateToResults(1);
}

function toggleAdvanced(event: Event) {
  advancedOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

function visibleImage(listing: Listing) {
  return listing.images.find(image => !failedImages.value.has(image.id));
}

function imageUrl(listing: Listing, image = visibleImage(listing)) {
  return image ? image.url ?? apiUrl(`/public/listings/${listing.id}/images/${image.id}`) : '';
}

function listingPath(id: string) {
  return { path: `/listings/${encodeURIComponent(id)}`, query: { ...route.query } };
}

function priceAmount(listing: Listing) {
  if (!hasRentalDomainData(listing)) return 'Precio a consultar';
  const amount = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(listing.priceAmount);
  return `${listing.currency} ${amount}`;
}

function durationSummary(value: RentalDuration | null) {
  return value === 'FLEXIBLE' ? 'Flexible' : rentalDurationLabel(value);
}

function imageFailed(imageId: string) {
  failedImages.value = new Set(failedImages.value).add(imageId);
}

watch(() => route.query, () => {
  syncFiltersFromRoute();
  void loadPage();
}, { immediate: true });
</script>

<template>
  <div class="catalog-page">
    <section class="catalog-intro" aria-labelledby="catalog-title">
      <p class="eyebrow">Alquiler mensual · Uspallata, Mendoza</p>
      <div class="catalog-intro-copy">
        <h1 id="catalog-title">Encontrá tu próximo alquiler mensual en Uspallata.</h1>
        <p>Compará precios publicados, duración declarada y disponibilidad. Consultá las condiciones directamente con cada propietario.</p>
      </div>
      <div class="catalog-intro-note" aria-label="Información del catálogo">
        <span aria-hidden="true">⌖</span><span>Valle de Uspallata</span>
      </div>
    </section>

    <section class="search-panel" aria-labelledby="search-title">
      <h2 id="search-title">Buscá un lugar para vivir</h2>
      <form class="catalog-search" @submit.prevent="navigateToResults(1)">
        <label class="search-location" for="filter-location">
          <span>Ubicación</span>
          <input id="filter-location" v-model="filters.location" name="location" autocomplete="address-level2" placeholder="Uspallata y alrededores" @keydown.enter.prevent="searchMonthly" />
        </label>
        <label class="quick-availability" for="filter-available">
          <input id="filter-available" v-model="filters.soloDisponibles" name="soloDisponibles" type="checkbox" />
          <span>Disponibilidad declarada como disponible</span>
        </label>
        <div class="catalog-search-actions">
          <button type="button" class="search-submit" :aria-busy="loading" @click="searchMonthly">
            <span aria-hidden="true">⌕</span> {{ loading ? 'Actualizando…' : 'Buscar alquiler mensual' }}
          </button>
          <button type="button" class="catalog-all-listings" @click="resetFilters">Ver todos los alquileres</button>
        </div>
        <details class="advanced-filters" :open="advancedOpen" @toggle="toggleAdvanced">
          <summary>Más filtros <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span></summary>
          <div class="advanced-filter-grid">
            <label for="filter-min-price">Precio mínimo<input id="filter-min-price" v-model="filters.minPriceAmount" name="minPriceAmount" type="number" min="0" inputmode="numeric" /></label>
            <label for="filter-max-price">Precio máximo<input id="filter-max-price" v-model="filters.maxPriceAmount" name="maxPriceAmount" type="number" min="0" inputmode="numeric" /></label>
            <label for="filter-currency">Moneda<select id="filter-currency" v-model="filters.currency" name="currency"><option value="">Cualquier moneda</option><option value="ARS">Pesos argentinos (ARS)</option><option value="USD">Dólares estadounidenses (USD)</option></select></label>
            <label for="filter-period">Periodicidad<select id="filter-period" v-model="filters.pricePeriod" name="pricePeriod"><option value="">Cualquiera</option><option v-for="option in pricePeriodOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label for="filter-duration">Duración<select id="filter-duration" v-model="filters.rentalDuration" name="rentalDuration"><option value="">Cualquiera</option><option v-for="option in rentalDurationOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label for="filter-occupants">Personas<input id="filter-occupants" v-model="filters.maxOccupants" name="maxOccupants" type="number" min="1" step="1" inputmode="numeric" placeholder="Cualquier capacidad" /></label>
          </div>
          <div class="filter-actions"><button type="submit" class="secondary">Aplicar filtros</button><button type="button" class="text-button" @click="resetFilters">Limpiar</button></div>
        </details>
      </form>
    </section>

    <section class="catalog-results" aria-labelledby="results-title" :aria-busy="loading">
      <div class="results-heading">
        <div><p class="eyebrow">El valle te espera</p><h2 id="results-title">{{ resultsTitle }}</h2></div>
        <p v-if="page" class="result-count" aria-live="polite">{{ page.totalItems }} {{ page.totalItems === 1 ? 'alojamiento' : 'alojamientos' }}</p>
      </div>

      <div v-if="loading && !page" class="catalog-loading" role="status" aria-live="polite">
        <span class="loading-mark" aria-hidden="true"></span><p>Buscando lugares para tu estadía…</p>
      </div>
      <div v-if="error" class="catalog-message error-state" role="alert">
        <div><strong>No pudimos actualizar el catálogo.</strong><p>{{ error }}<span v-if="page"> Conservamos los resultados anteriores.</span></p></div>
        <button type="button" class="secondary" @click="loadPage()">Reintentar</button>
      </div>
      <div v-else-if="loading && page" class="catalog-refresh" role="status" aria-live="polite">Actualizando resultados…</div>

      <template v-if="page">
        <div v-if="page.items.length" class="listing-grid" :class="{ 'is-refreshing': loading }" aria-label="Resultados de alojamientos">
          <article v-for="listing in page.items" :key="listing.id" class="listing-card">
            <RouterLink class="listing-card-photo" :to="listingPath(listing.id)" :aria-label="`Ver fotos y detalles de ${listing.title}`">
              <img v-if="visibleImage(listing)" :src="imageUrl(listing)" :alt="`Imagen de ${listing.title}, ${listing.location}`" loading="lazy" decoding="async" @error="imageFailed(visibleImage(listing)!.id)" />
              <span v-else class="photo-placeholder" role="img" :aria-label="listing.images.length ? `Fotografías no disponibles para ${listing.title}` : `Sin fotografías disponibles para ${listing.title}`"><span aria-hidden="true">⌁</span><small>{{ listing.images.length ? 'No pudimos cargar las fotos' : 'Sin fotografías disponibles' }}</small></span>
              <span class="photo-location">{{ listing.location }}</span>
            </RouterLink>
            <div class="listing-card-content">
              <h3><RouterLink :to="listingPath(listing.id)">{{ listing.title }}</RouterLink></h3>
              <p class="listing-description">{{ listing.description }}</p>
              <div class="listing-meta" aria-label="Características">
                <span v-if="listing.maxOccupants">Hasta {{ listing.maxOccupants }} {{ listing.maxOccupants === 1 ? 'persona' : 'personas' }}</span>
                <span v-else>Capacidad a consultar</span>
                <span v-if="listing.domainDataStatus === 'COMPLETE'">Duración: {{ durationSummary(listing.rentalDuration) }}</span>
              </div>
              <div class="listing-card-bottom">
                <p class="listing-price"><strong>{{ priceAmount(listing) }}</strong><span v-if="listing.pricePeriod">por {{ pricePeriodLabel(listing.pricePeriod) }}</span></p>
                <span class="availability-pill" :class="[`availability-${listing.freshnessStatus.toLowerCase()}`, { 'is-unavailable': listing.availabilityStatus === 'UNAVAILABLE' }]">
                  <span aria-hidden="true">{{ freshnessMarker(listing.freshnessStatus) }}</span>{{ availabilityLabel(listing.availabilityStatus, listing.freshnessStatus) }}
                </span>
              </div>
              <p class="listing-freshness" :class="`freshness-${listing.freshnessStatus.toLowerCase()}`">
                {{ freshnessLabel(listing.freshnessStatus, listing.lastConfirmedAt) }} · {{ formatConfirmationDate(listing.lastConfirmedAt) }}
              </p>
              <RouterLink class="listing-card-cta" :to="listingPath(listing.id)">Conocer el alojamiento <span aria-hidden="true">→</span></RouterLink>
            </div>
          </article>
        </div>
        <div v-else class="catalog-empty" role="status">
          <span class="empty-mark" aria-hidden="true">⌖</span><p class="eyebrow">Probemos otro camino</p><h3>No encontramos alojamientos con esos filtros.</h3><p>Ampliá la ubicación o quitá alguno de los filtros para ver más opciones.</p><button type="button" class="secondary" @click="resetFilters">Ver todos los alquileres</button>
        </div>
        <nav v-if="page.totalPages > 1" class="catalog-pagination" aria-label="Páginas de resultados">
          <button type="button" class="secondary" :disabled="loading || page.page <= 1" @click="navigateToResults(page.page - 1)">← Anterior</button>
          <span>Página <strong>{{ page.page }}</strong> de {{ page.totalPages }}</span>
          <button type="button" class="secondary" :disabled="loading || page.page >= page.totalPages" @click="navigateToResults(page.page + 1)">Siguiente →</button>
        </nav>
      </template>
    </section>
  </div>
</template>
