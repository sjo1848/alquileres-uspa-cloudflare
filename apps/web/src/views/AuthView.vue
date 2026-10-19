<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, request } from '../api';
import { useSession } from '../session';
import { safeLoginRedirect } from './auth-helpers';
const email = ref(''), password = ref(''), error = ref('');
const demoRole = ref<'OWNER'|'ADMIN'>('OWNER');
const loading = ref(false);
const notice = ref('');
const mockMailUrl = ref('');
const newPassword = ref('');
const strategy = ref<'LOADING'|'PASSWORD'|'ACCESS_PREVIEW'|'ERROR'>('LOADING');
const session = useSession(), router = useRouter(), route = useRoute();
const page = computed(() => route.path === '/register' ? 'register' : route.path === '/verify-email' ? 'verify' : route.path === '/recover' ? 'recover' : route.path === '/reset-password' ? 'reset' : 'login');
watch(() => route.fullPath, () => { error.value=''; notice.value=''; mockMailUrl.value=''; });
async function loadConfig() {
  strategy.value = 'LOADING'; error.value = '';
  try {
    strategy.value = await session.loadAuthStrategy();
  } catch { strategy.value='ERROR';error.value='El ingreso no está disponible. Reintentá en unos instantes.'; }
}
onMounted(loadConfig);
async function submitLocalFlow() {
  if(loading.value)return;
  loading.value=true;error.value='';notice.value='';
  try {
    if(page.value==='register') {
      const result=await request<{message:string}>('/auth/register',{method:'POST',body:JSON.stringify({email:email.value,password:password.value})});
      notice.value=result.message;password.value='';
    } else if(page.value==='verify') {
      await request('/auth/verify-email',{method:'POST',body:JSON.stringify({token:String(route.query.token??'')})});
      notice.value='Correo verificado. Ya podés iniciar sesión.';
    } else if(page.value==='recover') {
      const result=await request<{message:string}>('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email:email.value})});notice.value=result.message;
    } else if(page.value==='reset') {
      await request('/auth/password-reset/complete',{method:'POST',body:JSON.stringify({token:String(route.query.token??''),password:newPassword.value})});newPassword.value='';session.anonymous();await router.push('/login?reset=1');
    }
  } catch(e) { error.value=e instanceof ApiError&&e.status===400?'El enlace no es válido o venció. Solicitá uno nuevo.':'No se pudo completar la solicitud. Reintentá.'; }
  finally { loading.value=false; }
}
async function readLocalMailbox() {
  mockMailUrl.value='';
  try { const result=await request<{message:null|{url:string}}>('/__local/mailbox');if(result.message)mockMailUrl.value=result.message.url; }
  catch { error.value='El correo simulado solo está disponible en el entorno local.'; }
}
async function submit() {
  if (loading.value) return;
  loading.value = true; error.value = '';
  try {
    if(strategy.value==='ACCESS_PREVIEW')await session.authenticatePreview(demoRole.value);
    else if(strategy.value==='PASSWORD')await session.authenticate('/auth/login', email.value, password.value);
    else return;
    password.value = '';
    const authenticatedRole = session.role.value;
    if (authenticatedRole !== 'OWNER' && authenticatedRole !== 'ADMIN') throw new Error('Authenticated role is missing');
    await router.push(safeLoginRedirect(route.query.redirect, authenticatedRole) ?? (authenticatedRole === 'ADMIN' ? '/admin' : '/owner'));
  } catch (e) {
    error.value = e instanceof ApiError && e.status === 401
      ? strategy.value==='ACCESS_PREVIEW'?'No pudimos verificar tu acceso. Volvé a ingresar al Preview.':'Email o contraseña incorrectos.'
      : 'No pudimos iniciar sesión. Reintentá en unos instantes.';
  } finally { loading.value = false; }
}
</script>
<template>
  <section class="card">
    <p class="eyebrow">Acceso de propietarios</p><h2>{{ page==='register'?'Crear cuenta':page==='verify'?'Verificar correo':page==='recover'?'Recuperar contraseña':page==='reset'?'Restablecer contraseña':'Iniciar sesión' }}</h2>
    <p v-if="route.query.reset" role="status">La contraseña fue actualizada. Iniciá sesión con la nueva contraseña.</p>
    <p v-if="route.query.expired" class="error" role="alert">La sesión expiró. Ingresá nuevamente.</p>
    <p v-if="route.query.unavailable" class="error" role="alert">No pudimos verificar la sesión. Podés reintentar el ingreso.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
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
    <form v-if="strategy==='PASSWORD'&&page==='login'" @submit.prevent="submit" :aria-busy="loading">
      <fieldset :disabled="loading">
        <label for="email">Email</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" />
        <label for="password">Contraseña</label><input id="password" v-model="password" type="password" autocomplete="current-password" minlength="8" required />
        <button type="submit">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
      </fieldset>
    </form>
    <form v-if="strategy==='PASSWORD'&&page==='register'" @submit.prevent="submitLocalFlow" :aria-busy="loading">
      <fieldset :disabled="loading"><label for="email">Email sintético</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" /><label for="password">Contraseña (12 caracteres mínimo)</label><input id="password" v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><button type="submit">{{ loading?'Procesando…':'Crear cuenta de propietario' }}</button></fieldset>
    </form>
    <form v-if="strategy==='PASSWORD'&&page==='verify'" @submit.prevent="submitLocalFlow" :aria-busy="loading"><p>Confirmá la verificación del enlace sintético.</p><button :disabled="loading||!route.query.token" type="submit">Verificar correo</button></form>
    <form v-if="strategy==='PASSWORD'&&page==='recover'" @submit.prevent="submitLocalFlow" :aria-busy="loading"><fieldset :disabled="loading"><label for="email">Email</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" /><button type="submit">Solicitar enlace de recuperación</button></fieldset></form>
    <form v-if="strategy==='PASSWORD'&&page==='reset'" @submit.prevent="submitLocalFlow" :aria-busy="loading"><fieldset :disabled="loading"><label for="password">Nueva contraseña</label><input id="password" v-model="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><button type="submit">Actualizar contraseña</button></fieldset></form>
    <button v-if="strategy==='PASSWORD'&&(page==='register'||page==='recover')" type="button" @click="readLocalMailbox">Consultar correo de prueba</button>
    <a v-if="mockMailUrl" :href="mockMailUrl">Abrir enlace recibido</a>
    <nav v-if="strategy==='PASSWORD'" aria-label="Opciones de acceso"><RouterLink v-if="page!=='login'" to="/login">Iniciar sesión</RouterLink><RouterLink v-if="page==='login'" to="/register">Crear cuenta</RouterLink><RouterLink v-if="page==='login'" to="/recover">¿Olvidaste tu contraseña?</RouterLink></nav>
    <RouterLink to="/">Volver al catálogo</RouterLink>
  </section>
</template>
