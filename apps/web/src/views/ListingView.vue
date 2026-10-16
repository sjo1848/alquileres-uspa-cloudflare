<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiUrl, ApiError, publicListingPath, request } from '../api';
import { useRoute } from 'vue-router';
import {
  availabilityLabel,
  formatConfirmationDate,
  freshnessLabel,
  freshnessMarker,
  type AvailabilityStatus,
  type FreshnessStatus,
} from './availability-helpers';
import {
  formatRentalPrice,
  hasRentalDomainData,
  rentalDurationLabel,
  type Currency,
  type PricePeriod,
  type RentalDuration,
} from './rental-domain';
const route = useRoute();
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
  availabilityStatus: AvailabilityStatus;
  lastConfirmedAt: string | null;
  freshnessStatus: FreshnessStatus;
  images: { id: string; contentType: string; position: number }[];
};
const listing = ref<Listing>();
const loading = ref(true);
const error = ref('');
const failedImages = ref(new Set<string>());
function resetState() {
  loading.value = true;
  error.value = '';
  listing.value = undefined;
  failedImages.value = new Set();
}
async function load(id: string) {
  resetState();
  try {
    const nextListing = await request<Listing>(publicListingPath(id));
    if (route.params.id === id) listing.value = nextListing;
  } catch (e) {
    if (route.params.id === id) {
      error.value =
        e instanceof ApiError ? e.message : 'No pudimos cargar la ficha.';
    }
  } finally {
    if (route.params.id === id) loading.value = false;
  }
}
function retry() {
  void load(String(route.params.id));
}
function imageFailed(imageId: string) {
  failedImages.value = new Set(failedImages.value).add(imageId);
}
const freshness = computed(() =>
  freshnessLabel(
    listing.value?.freshnessStatus,
    listing.value?.lastConfirmedAt,
  ),
);
watch(
  () => route.params.id,
  (id) => void load(String(id)),
  { immediate: true },
);
</script>
<template>
  <p v-if="loading" aria-live="polite">Cargando ficha…</p>
  <section v-else-if="error" class="error-state card" role="alert">
    <p class="error">{{ error }}</p>
    <div class="session-actions">
      <button type="button" @click="retry">Reintentar</button>
      <RouterLink class="button-link secondary" to="/"
        >Volver al buscador</RouterLink
      >
    </div>
  </section>
  <template v-else-if="listing"
    ><p><RouterLink to="/">← Volver al buscador</RouterLink></p>
    <article class="detail card">
      <p class="eyebrow">{{ listing.location }}</p>
      <h2>{{ listing.title }}</h2>
      <div v-if="listing.images.length" class="gallery">
        <template v-for="image in listing.images" :key="image.id">
          <img
            v-if="!failedImages.has(image.id)"
            :src="apiUrl(`/public/listings/${listing.id}/images/${image.id}`)"
            :alt="`Imagen de ${listing.title}`"
            @error="imageFailed(image.id)"
          />
          <div
            v-else
            class="image-placeholder"
            role="img"
            :aria-label="`Imagen no disponible para ${listing.title}`"
          >
            🏔️
          </div>
        </template>
      </div>
      <div
        v-else
        class="image-placeholder gallery-placeholder"
        role="img"
        :aria-label="`Galería vacía para ${listing.title}`"
      >
        <span>Sin imágenes disponibles</span>
      </div>
      <p>{{ listing.description }}</p>
      <p class="rental-summary">{{ formatRentalPrice(listing) }}</p>
      <p
        v-if="
          listing.domainDataStatus === 'COMPLETE' &&
          hasRentalDomainData(listing)
        "
      >
        Duración: {{ rentalDurationLabel(listing.rentalDuration) }}
      </p>
      <p
        class="status"
        :class="[
          listing.availabilityStatus === 'AVAILABLE'
            ? 'available'
            : 'unavailable',
          listing.freshnessStatus !== 'FRESH' ? 'availability-unconfirmed' : '',
        ]"
      >
        {{
          availabilityLabel(listing.availabilityStatus, listing.freshnessStatus)
        }}
      </p>
      <p
        class="freshness"
        :class="`freshness-${listing.freshnessStatus.toLowerCase()}`"
        role="status"
      >
        <span aria-hidden="true">{{
          freshnessMarker(listing.freshnessStatus)
        }}</span>
        {{ freshness }} · última confirmación:
        {{ formatConfirmationDate(listing.lastConfirmedAt) }}
      </p>
    </article>
  </template>
</template>
