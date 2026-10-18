<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '../api';
import { useSession } from '../session';
import { safeLoginRedirect } from './auth-helpers';
const email = ref(''), password = ref(''), error = ref('');
const demoRole = ref<'OWNER'|'ADMIN'>('OWNER');
const loading = ref(false);
const strategy = ref<'LOADING'|'PASSWORD'|'ACCESS_PREVIEW'|'ERROR'>('LOADING');
const session = useSession(), router = useRouter(), route = useRoute();
async function loadConfig() {
  strategy.value = 'LOADING'; error.value = '';
  try {
    strategy.value = await session.loadAuthStrategy();
  } catch { strategy.value='ERROR';error.value='El ingreso no está disponible. Reintentá en unos instantes.'; }
}
onMounted(loadConfig);
async function submit() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  try {
    if(strategy.value==='ACCESS_PREVIEW')await session.authenticatePreview(demoRole.value);
    else if(strategy.value==='PASSWORD')await session.authenticate('/auth/login', email.value, password.value);
    else return;
    password.value = '';
    await router.push(safeLoginRedirect(route.query.redirect) ?? (session.role.value === 'ADMIN' ? '/admin' : '/owner'));
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 401
      ? strategy.value==='ACCESS_PREVIEW'?'No pudimos verificar tu acceso. Volvé a ingresar al Preview.':'Email o contraseña incorrectos.'
      : 'No pudimos iniciar sesión. Reintentá en unos instantes.';
  } finally { loading.value = false; }
}
</script>
<template>
  <section class="card">
    <p class="eyebrow">Acceso de propietarios</p><h2>Iniciar sesión</h2>
    <p v-if="route.query.expired" class="error" role="alert">La sesión expiró. Ingresá nuevamente.</p>
    <p v-if="route.query.unavailable" class="error" role="alert">No pudimos verificar la sesión. Podés reintentar el ingreso.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="strategy==='LOADING'" role="status">Preparando el ingreso…</p>
    <button v-if="strategy==='ERROR'" @click="loadConfig">Reintentar</button>
    <form v-if="strategy==='ACCESS_PREVIEW'" @submit.prevent="submit" :aria-busy="loading">
      <p>Ingresá con tu acceso habitual. Elegí un perfil sintético de demostración; no cambia tu rol ni tus datos de producción.</p>
      <fieldset :disabled="loading">
        <legend>Entrar como</legend>
        <label><input v-model="demoRole" type="radio" name="demo-role" value="OWNER" /> Propietario (demo)</label>
        <label><input v-model="demoRole" type="radio" name="demo-role" value="ADMIN" /> Administrador (demo)</label>
        <button type="submit">{{ loading?'Ingresando…':demoRole==='ADMIN'?'Ingresar como administrador (demo)':'Ingresar como propietario (demo)' }}</button>
      </fieldset>
    </form>
    <form v-if="strategy==='PASSWORD'" @submit.prevent="submit" :aria-busy="loading">
      <fieldset :disabled="loading">
        <label for="email">Email</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" />
        <label for="password">Contraseña</label><input id="password" v-model="password" type="password" autocomplete="current-password" minlength="8" required />
        <button type="submit">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
      </fieldset>
    </form>
    <RouterLink to="/">Volver al catálogo</RouterLink>
  </section>
</template>
