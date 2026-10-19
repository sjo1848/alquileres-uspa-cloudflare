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

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault();
    closeMenu(true);
  }
}

watch(() => route.fullPath, () => closeMenu());
onMounted(() => document.addEventListener('keydown', onEscape));
onBeforeUnmount(() => document.removeEventListener('keydown', onEscape));

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await session.clear();
    closeMenu();
    await router.push('/');
  } catch {
    logoutError.value = 'No pudimos cerrar la sesión. Reintentá.';
  } finally {
    loggingOut.value = false;
  }
}

async function switchDemoIdentity() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await session.clear();
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
    <RouterLink class="brand" to="/" aria-label="Alquileres Uspallata, inicio" @click="closeMenu()">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-copy"><span class="brand-name">Uspallata</span><span class="brand-caption">Alojamientos en el valle</span></span>
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
        <RouterLink to="/" @click="closeMenu()">Descubrir</RouterLink>
        <RouterLink v-if="session.role.value === 'OWNER'" to="/owner" @click="closeMenu()">Mis publicaciones</RouterLink>
        <RouterLink v-if="session.role.value === 'ADMIN'" to="/admin" @click="closeMenu()">Revisión</RouterLink>
        <RouterLink v-if="session.role.value === 'ADMIN'" to="/admin-assist" @click="closeMenu()">Gestión asistida</RouterLink>
        <RouterLink v-if="!session.isAuthenticated.value" class="nav-cta" to="/login" @click="closeMenu()">Ingresar</RouterLink>
      </nav>
      <div class="nav-actions">
        <button
          v-if="session.isAuthenticated.value && session.authStrategy.value === 'ACCESS_PREVIEW'"
          class="nav-quiet"
          :disabled="loggingOut"
          @click="switchDemoIdentity"
        >Cambiar perfil de prueba</button>
        <button v-if="session.isAuthenticated.value" class="nav-quiet" :disabled="loggingOut" @click="logout">
          {{ loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión' }}
        </button>
      </div>
    </div>
    <p v-if="logoutError" class="error nav-error" role="alert">{{ logoutError }}</p>
  </header>

  <main id="main-content" class="app-shell app-main" tabindex="-1"><RouterView /></main>
  <footer class="app-shell app-footer"><span>Alquileres Uspallata</span><span>Mendoza · Argentina</span></footer>
</template>
