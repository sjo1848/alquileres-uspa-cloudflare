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
  hasRentalDomainData,
  pricePeriodLabel,
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
  images: { id: string; contentType: string; position: number; url?: string }[];
};
const listing = ref<Listing>();
const loading = ref(true);
const error = ref('');
const failedImages = ref(new Set<string>());
const contact = ref({ visitorName: '', visitorEmail: '', message: '' });
const contactBusy = ref(false);
const contactError = ref('');
const contactNotice = ref('');
let pendingContact: { identity: string; key: string } | undefined;
let contactRequestGeneration = 0;
let loadController: AbortController | undefined;
const returnToCatalog = computed(() => ({ path: '/', query: { ...route.query } }));

function resetState() {
  loadController?.abort();
  contactRequestGeneration++;
  loading.value = true;
  error.value = '';
  listing.value = undefined;
  failedImages.value = new Set();
  contact.value = { visitorName: '', visitorEmail: '', message: '' };
  contactBusy.value = false;
  contactError.value = '';
  contactNotice.value = '';
  pendingContact = undefined;
}

async function load(id: string) {
  resetState();
  const controller = new AbortController();
  loadController = controller;
  try {
    const nextListing = await request<Listing>(publicListingPath(id), { signal: controller.signal });
    if (!controller.signal.aborted && route.params.id === id) listing.value = nextListing;
  } catch (cause) {
    if (controller.signal.aborted || route.params.id !== id) return;
    error.value = cause instanceof ApiError ? cause.message : 'No pudimos cargar la ficha.';
  } finally {
    if (!controller.signal.aborted && route.params.id === id) loading.value = false;
  }
}

function retry() {
  void load(String(route.params.id));
}

function imageFailed(imageId: string) {
  failedImages.value = new Set(failedImages.value).add(imageId);
}

function imageUrl(image: Listing['images'][number]) {
  return image.url ?? apiUrl(`/public/listings/${listing.value?.id}/images/${image.id}`);
}

function detailPrice(value: Listing) {
  if (!hasRentalDomainData(value)) return 'Precio a consultar';
  const amount = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value.priceAmount);
  return `${value.currency} ${amount} por ${pricePeriodLabel(value.pricePeriod)}`;
}

async function sendContact() {
  if (!listing.value || contactBusy.value) return;
  const submittedListingId = listing.value.id;
  const generation = contactRequestGeneration;
  contactBusy.value = true;
  contactError.value = '';
  contactNotice.value = '';
  try {
    const body = JSON.stringify(contact.value);
    const identity = `${submittedListingId}|${body}`;
    if (pendingContact?.identity !== identity) pendingContact = { identity, key: crypto.randomUUID() };
    await request(`/public/listings/${encodeURIComponent(submittedListingId)}/contact`, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': pendingContact.key },
    });
    if (generation !== contactRequestGeneration || route.params.id !== submittedListingId) return;
    pendingContact = undefined;
    contact.value = { visitorName: '', visitorEmail: '', message: '' };
    contactNotice.value = 'Tu consulta fue enviada. El propietario podrá responderte por correo. Este envío no confirma una reserva.';
  } catch (cause) {
    if (generation === contactRequestGeneration && route.params.id === submittedListingId) {
      contactError.value = cause instanceof ApiError && cause.status === 400
        ? 'Revisá tu nombre, correo y mensaje.'
        : 'No pudimos enviar la consulta. Tus datos siguen acá; podés reintentar.';
    }
  } finally {
    if (generation === contactRequestGeneration && route.params.id === submittedListingId) contactBusy.value = false;
  }
}

const freshness = computed(() => freshnessLabel(listing.value?.freshnessStatus, listing.value?.lastConfirmedAt));
const rentalContext = computed(() => {
  if (!listing.value || !hasRentalDomainData(listing.value)) {
    return 'Consultá el precio y las condiciones directamente con el propietario.';
  }
  const period = pricePeriodLabel(listing.value.pricePeriod);
  return `Precio publicado por ${period}. Consultá la duración y las condiciones antes de avanzar.`;
});
const availableImages = computed(() => listing.value?.images.filter(image => !failedImages.value.has(image.id)) ?? []);
const primaryImage = computed(() => availableImages.value[0]);
const secondaryImages = computed(() => availableImages.value.slice(1));

watch(() => route.params.id, id => void load(String(id)), { immediate: true });
</script>

<template>
  <div class="listing-page">
    <p v-if="loading" class="detail-loading" role="status" aria-live="polite"><span class="loading-mark" aria-hidden="true"></span>Cargando ficha…</p>
    <section v-else-if="error" class="detail-error card" role="alert">
      <p class="eyebrow">No pudimos abrir este alojamiento</p><h1>Intentemos de nuevo</h1><p>{{ error }}</p>
      <div class="detail-actions"><button type="button" @click="retry">Reintentar</button><RouterLink class="button-link secondary" :to="returnToCatalog">Volver al catálogo</RouterLink></div>
    </section>

    <template v-else-if="listing">
      <nav class="listing-breadcrumb" aria-label="Migas de pan"><RouterLink :to="returnToCatalog">← Alojamientos</RouterLink><span aria-hidden="true">/</span><span>{{ listing.location }}</span></nav>
      <div class="listing-detail-layout">
        <section class="listing-detail-main">
          <header class="detail-heading">
            <p class="eyebrow">{{ listing.location }}</p><h1>{{ listing.title }}</h1>
            <p class="detail-lede">{{ rentalContext }}</p>
            <a class="detail-contact-cta" href="#contact-form">Consultar este alojamiento <span aria-hidden="true">→</span></a>
          </header>

          <section class="detail-gallery" :class="{ 'detail-gallery-single': availableImages.length < 2 }" aria-label="Fotos del alojamiento">
            <figure v-if="primaryImage && !failedImages.has(primaryImage.id)" class="detail-gallery-primary">
              <img :src="imageUrl(primaryImage)" :alt="`Imagen de ${listing.title}, ${listing.location}`" fetchpriority="high" @error="imageFailed(primaryImage.id)" />
              <figcaption> {{ listing.location }} </figcaption>
            </figure>
            <div v-else class="detail-gallery-empty photo-placeholder" role="img" :aria-label="listing.images.length ? `Fotografías no disponibles para ${listing.title}` : `Sin fotografías disponibles para ${listing.title}`"><span aria-hidden="true">⌁</span><small>{{ listing.images.length ? 'No pudimos cargar las fotos' : 'Sin fotografías disponibles' }}</small></div>
            <figure v-for="image in secondaryImages" :key="image.id" class="detail-gallery-secondary">
              <img v-if="!failedImages.has(image.id)" :src="imageUrl(image)" :alt="`Vista adicional de ${listing.title}, ${listing.location}`" loading="lazy" decoding="async" @error="imageFailed(image.id)" />
              <div v-else class="photo-placeholder" role="img" :aria-label="`Imagen no disponible para ${listing.title}`"><span aria-hidden="true">⌁</span><small>{{ listing.location }}</small></div>
            </figure>
          </section>

          <section class="detail-overview card" aria-labelledby="overview-title">
            <div class="detail-overview-heading"><div><p class="eyebrow">La estadía</p><h2 id="overview-title">Sobre este alojamiento</h2></div><p v-if="listing.maxOccupants" class="capacity-chip">Hasta {{ listing.maxOccupants }} {{ listing.maxOccupants === 1 ? 'persona' : 'personas' }}</p></div>
            <p class="detail-description">{{ listing.description }}</p>
            <dl class="detail-facts">
              <div><dt>Precio publicado</dt><dd>{{ detailPrice(listing) }}</dd></div>
              <div v-if="listing.domainDataStatus === 'COMPLETE'"><dt>Duración del alquiler</dt><dd>{{ rentalDurationLabel(listing.rentalDuration) }}</dd></div>
              <div><dt>Ubicación</dt><dd>{{ listing.location }}</dd></div>
            </dl>
          </section>

          <section class="detail-availability" aria-labelledby="availability-title">
            <div><p class="eyebrow">Información del propietario</p><h2 id="availability-title">Disponibilidad</h2></div>
            <div class="availability-detail-card">
              <p class="availability-pill" :class="[`availability-${listing.freshnessStatus.toLowerCase()}`, { 'is-unavailable': listing.availabilityStatus === 'UNAVAILABLE' }]">
                <span aria-hidden="true">{{ freshnessMarker(listing.freshnessStatus) }}</span>{{ availabilityLabel(listing.availabilityStatus, listing.freshnessStatus) }}
              </p>
              <p class="listing-freshness" :class="`freshness-${listing.freshnessStatus.toLowerCase()}`">{{ freshness }} · {{ formatConfirmationDate(listing.lastConfirmedAt) }}</p>
              <p class="availability-disclaimer">El estado refleja la última información declarada y puede haber cambiado. Confirmá las condiciones con el propietario; esta consulta no reserva el alquiler.</p>
            </div>
          </section>
        </section>

        <aside id="contact-form" class="contact-panel card" aria-labelledby="contact-title">
          <p class="eyebrow">Contacto directo</p><h2 id="contact-title">¿Te interesa?</h2>
          <p class="contact-intro">Contale al propietario qué alquiler estás buscando. Enviar una consulta no reserva el alojamiento.</p>
          <p v-if="contactError" class="contact-feedback error" role="alert">{{ contactError }}</p>
          <p v-if="contactNotice" class="contact-feedback success" role="status">{{ contactNotice }}</p>
          <form class="public-contact-form" @submit.prevent="sendContact" :aria-busy="contactBusy">
            <fieldset :disabled="contactBusy">
              <label for="visitor-name"><span>Tu nombre</span><input id="visitor-name" v-model="contact.visitorName" name="visitorName" required maxlength="120" autocomplete="name" /></label>
              <label for="visitor-email"><span>Tu correo</span><input id="visitor-email" v-model="contact.visitorEmail" name="visitorEmail" required maxlength="254" type="email" autocomplete="email" /></label>
              <label for="visitor-message"><span>Mensaje</span><textarea id="visitor-message" v-model="contact.message" name="message" required maxlength="2000" rows="4" placeholder="¿Desde cuándo buscás alquilar? ¿Cuántas personas vivirían aquí?"></textarea></label>
              <button type="submit" class="contact-submit">{{ contactBusy ? 'Enviando consulta…' : 'Enviar consulta' }} <span aria-hidden="true">→</span></button>
            </fieldset>
          </form>
          <p class="contact-privacy">Tus datos se envían para que el propietario pueda responder esta consulta. No se realiza una reserva.</p>
        </aside>
      </div>
    </template>
  </div>
</template>
