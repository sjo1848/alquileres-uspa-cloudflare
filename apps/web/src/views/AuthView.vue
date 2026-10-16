<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '../api';
import { useSession } from '../session';
import { safeLoginRedirect } from './auth-helpers';
const email = ref(''), password = ref(''), error = ref('');
const loading = ref(false);
const session = useSession(), router = useRouter(), route = useRoute();
async function submit() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  try {
    await session.authenticate('/auth/login', email.value, password.value);
    password.value = '';
    await router.push(safeLoginRedirect(route.query.redirect) ?? '/owner');
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 401
      ? 'Email o contraseña incorrectos.' : 'No pudimos iniciar sesión. Reintentá en unos instantes.';
  } finally { loading.value = false; }
}
</script>
<template>
  <section class="card">
    <p class="eyebrow">Acceso de propietarios</p><h2>Iniciar sesión</h2>
    <p v-if="route.query.expired" class="error" role="alert">La sesión expiró. Ingresá nuevamente.</p>
    <p v-if="route.query.unavailable" class="error" role="alert">No pudimos verificar la sesión. Podés reintentar el ingreso.</p>
    <form @submit.prevent="submit" :aria-busy="loading">
      <fieldset :disabled="loading">
        <label for="email">Email</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" />
        <label for="password">Contraseña</label><input id="password" v-model="password" type="password" autocomplete="current-password" minlength="8" required />
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button type="submit">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
      </fieldset>
    </form>
    <RouterLink to="/">Volver al catálogo</RouterLink>
  </section>
</template>
