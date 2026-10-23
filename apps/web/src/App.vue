<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSession } from './session';

const session = useSession();
const router = useRouter();
const route = useRoute();
const loggingOut = ref(false);
const logoutError = ref('');
const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);

onMounted(() => { void session.loadAuthStrategy().catch(() => {}); });

function closeMenu(restoreFocus = false) {
  menuOpen.value = false;
  if (restoreFocus) void nextTick(() => menuButton.value?.focus());
}

function focusMain() {
  void nextTick(() => document.getElementById('main-content')?.focus({ preventScroll: true }));
}

function navigate() {
  closeMenu();
  focusMain();
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault();
    closeMenu(true);
  }
}

watch(() => route.fullPath, () => {
  closeMenu();
  focusMain();
});
onMounted(() => document.addEventListener('keydown', onEscape));
onBeforeUnmount(() => document.removeEventListener('keydown', onEscape));

async function logout(event:MouseEvent) {
  if (loggingOut.value) return;
  if(event.currentTarget instanceof HTMLElement)event.currentTarget.focus({preventScroll:true});
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await router.push('/');
    if (route.path !== '/') return;
    try {
      await session.clear();
    } catch (error) {
      await router.push(session.role.value === 'ADMIN' ? '/admin' : '/owner');
      throw error;
    }
    closeMenu();
    focusMain();
  } catch {
    logoutError.value = 'No pudimos cerrar la sesión. Reintentá.';
  } finally {
    loggingOut.value = false;
  }
}

async function switchDemoIdentity(event:MouseEvent) {
  if (loggingOut.value) return;
  if(event.currentTarget instanceof HTMLElement)event.currentTarget.focus({preventScroll:true});
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await router.push('/');
    if (route.path !== '/') return;
    try {
      await session.clear();
    } catch (error) {
      await router.push(session.role.value === 'ADMIN' ? '/admin' : '/owner');
      throw error;
    }
    closeMenu();
    await router.push('/login');
  } catch {
    logoutError.value = 'No pudimos cambiar la identidad de prueba. Reintentá.';
  } finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <a class="skip-link" href="#main-content">Saltar al contenido</a>
  <header class="app-header app-shell">
    <RouterLink class="brand" to="/" aria-label="Alquileres Uspallata, inicio" @click="navigate()">
      <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M5 35 18 13l7 11 5-8 13 19H5Z" fill="var(--color-clay)" />
        <path d="m18 13 4 7-5-2-4 7 5-12Zm12 3 4 8-5-3-4 6 5-11Z" fill="var(--color-paper)" />
        <path d="M8 39h33" stroke="var(--color-danger)" stroke-width="2.5" stroke-linecap="round" />
      </svg>
      <span class="brand-copy"><span class="brand-name">USPALLATA</span><span class="brand-caption">Alojamientos de montaña</span></span>
    </RouterLink>

    <button
      ref="menuButton"
      class="menu-toggle"
      type="button"
      aria-controls="primary-navigation"
      :aria-expanded="menuOpen"
      :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'"
      @click="menuOpen = !menuOpen"
    >
      <span aria-hidden="true">{{ menuOpen ? '×' : '☰' }}</span>
    </button>

    <div id="primary-navigation" class="navigation-panel" :class="{ 'is-open': menuOpen }">
      <nav class="primary-nav" aria-label="Navegación principal">
        <RouterLink to="/" @click="navigate()">Descubrir</RouterLink>
        <RouterLink v-if="session.role.value === 'OWNER'" to="/owner" @click="navigate()">Mis publicaciones</RouterLink>
        <RouterLink v-if="session.role.value === 'ADMIN'" to="/admin" @click="navigate()">Revisión</RouterLink>
        <RouterLink v-if="session.role.value === 'ADMIN'" to="/admin-assist" @click="navigate()">Gestión asistida</RouterLink>
        <RouterLink v-if="!session.isAuthenticated.value" class="nav-cta" to="/login" @click="navigate()">Ingresar</RouterLink>
      </nav>
      <div class="nav-actions">
        <button
          v-if="session.isAuthenticated.value && session.authStrategy.value === 'ACCESS_PREVIEW'"
          class="nav-quiet"
          @click="switchDemoIdentity($event)"
        >Cambiar perfil de prueba</button>
        <button v-if="session.isAuthenticated.value" class="nav-quiet" @click="logout($event)">
          {{ loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión' }}
        </button>
      </div>
    </div>
    <p v-if="logoutError" class="error nav-error" role="alert">{{ logoutError }}</p>
  </header>

  <main id="main-content" class="app-shell app-main" tabindex="-1"><RouterView /></main>
  <footer class="app-shell app-footer"><span>Alquileres Uspallata</span><span>Mendoza · Argentina</span></footer>
</template>
