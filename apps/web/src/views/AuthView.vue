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
const heading = computed(() => page.value==='register'?'Creá tu cuenta de propietario':page.value==='verify'?'Verificá tu correo':page.value==='recover'?'Recuperá el acceso':page.value==='reset'?'Elegí una nueva contraseña':'Ingresá a tu espacio');
const description = computed(() => page.value==='register'?'Prepará tu alojamiento y empezá a organizar cada detalle.':page.value==='verify'?'Confirmá tu dirección con el enlace de prueba que recibiste.':page.value==='recover'?'Te enviaremos un enlace simulado si la cuenta puede recibir una recuperación.':page.value==='reset'?'El enlace de recuperación es temporal y de un solo uso.':'Gestioná tus publicaciones y consultas desde un solo lugar.');
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
  <section class="auth-page">
    <aside class="auth-story" aria-label="Bienvenida al espacio de propietarios">
      <p class="eyebrow">Uspallata · Mendoza</p>
      <span class="auth-story-mark" aria-hidden="true">⌂</span>
      <p class="auth-story-kicker">Hospitalidad de montaña</p>
      <p class="auth-story-quote">Un buen lugar empieza con una historia.</p>
      <p class="auth-story-copy">Mostrá tu alojamiento, mantené la información al día y recibí consultas en un espacio sencillo.</p>
      <span class="auth-story-line" aria-hidden="true"></span>
    </aside>
    <div class="auth-content card">
      <header class="auth-heading">
        <p class="eyebrow">{{ strategy==='ACCESS_PREVIEW'?'Acceso protegido':'Espacio del propietario' }}</p>
        <h1>{{ heading }}</h1>
        <p>{{ description }}</p>
      </header>
      <p v-if="strategy==='PASSWORD'" class="auth-local-note" role="note"><strong>Entorno local de prueba.</strong> Las cuentas y el correo son sintéticos; no se envían mensajes reales.</p>
      <p v-if="route.query.reset" class="auth-feedback success" role="status">La contraseña fue actualizada. Iniciá sesión con la nueva contraseña.</p>
      <p v-if="route.query.expired" class="auth-feedback error" role="alert">La sesión expiró. Ingresá nuevamente para proteger tus cambios.</p>
      <p v-if="route.query.unavailable" class="auth-feedback error" role="alert">No pudimos verificar la sesión. Podés reintentar el ingreso.</p>
      <p v-if="error" class="auth-feedback error" role="alert">{{ error }}</p>
      <p v-if="notice" class="auth-feedback success" role="status">{{ notice }}</p>
      <p v-if="strategy==='LOADING'" class="auth-loading" role="status">Preparando el ingreso…</p>
      <button v-if="strategy==='ERROR'" type="button" class="secondary" @click="loadConfig">Reintentar</button>

      <div v-if="strategy==='ACCESS_PREVIEW'&&page!=='login'" class="auth-preview-locked" role="status">
        <h2>El alta local no está disponible en Preview</h2>
        <p>Este entorno requiere tu identidad de Cloudflare Access. El registro y el restablecimiento por contraseña simulados solo funcionan en el entorno local.</p>
        <RouterLink class="button-link" to="/login">Continuar con Access</RouterLink>
      </div>
      <form v-if="strategy==='ACCESS_PREVIEW'&&page==='login'" class="auth-form" @submit.prevent="submit" :aria-busy="loading">
        <p>Ingresá con tu identidad autorizada. Elegir un perfil sintético habilita solamente datos de prueba del Preview.</p>
        <fieldset :disabled="loading">
          <legend>Perfil de demostración</legend>
          <label class="auth-choice"><input v-model="demoRole" type="radio" name="demo-role" value="OWNER" /> Propietario</label>
          <label class="auth-choice"><input v-model="demoRole" type="radio" name="demo-role" value="ADMIN" /> Administrador</label>
          <button type="submit">{{ loading?'Ingresando…':demoRole==='ADMIN'?'Continuar como administrador':'Continuar como propietario' }}</button>
        </fieldset>
      </form>

      <form v-if="strategy==='PASSWORD'&&page==='login'" class="auth-form" @submit.prevent="submit" :aria-busy="loading">
        <fieldset :disabled="loading">
          <label for="email">Correo electrónico</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" />
          <label for="password">Contraseña</label><input id="password" v-model="password" type="password" autocomplete="current-password" minlength="8" required />
          <button type="submit">{{ loading ? 'Ingresando…' : 'Ingresar' }}</button>
        </fieldset>
      </form>
      <form v-if="strategy==='PASSWORD'&&page==='register'" class="auth-form" @submit.prevent="submitLocalFlow" :aria-busy="loading">
        <fieldset :disabled="loading"><label for="email">Correo de prueba</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" /><label for="password">Contraseña <span>(12 caracteres como mínimo)</span></label><input id="password" v-model="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><button type="submit">{{ loading?'Creando cuenta…':'Crear cuenta de propietario' }}</button></fieldset>
      </form>
      <form v-if="strategy==='PASSWORD'&&page==='verify'" class="auth-form" @submit.prevent="submitLocalFlow" :aria-busy="loading"><p>El enlace de verificación vence y se puede usar una sola vez.</p><button :disabled="loading||!route.query.token" type="submit">{{ loading?'Verificando…':'Verificar correo de prueba' }}</button></form>
      <form v-if="strategy==='PASSWORD'&&page==='recover'" class="auth-form" @submit.prevent="submitLocalFlow" :aria-busy="loading"><fieldset :disabled="loading"><label for="email">Correo electrónico</label><input id="email" v-model="email" type="email" autocomplete="email" required maxlength="254" /><button type="submit">{{ loading?'Preparando enlace…':'Solicitar recuperación' }}</button></fieldset><p class="auth-form-hint">La respuesta es igual para cuentas existentes y direcciones desconocidas.</p></form>
      <form v-if="strategy==='PASSWORD'&&page==='reset'" class="auth-form" @submit.prevent="submitLocalFlow" :aria-busy="loading"><fieldset :disabled="loading"><label for="password">Nueva contraseña</label><input id="password" v-model="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><button type="submit">{{ loading?'Actualizando…':'Guardar contraseña nueva' }}</button></fieldset></form>

      <div v-if="strategy==='PASSWORD'&&(page==='register'||page==='recover')" class="auth-mailbox">
        <button type="button" class="secondary" :disabled="loading" @click="readLocalMailbox">Consultar bandeja de prueba</button>
        <a v-if="mockMailUrl" :href="mockMailUrl">{{ page==='recover'?'Abrir enlace de recuperación':'Abrir enlace de verificación' }}</a>
        <p>La bandeja solo existe en este proceso local y no envía correos.</p>
      </div>
      <nav v-if="strategy==='PASSWORD'" class="auth-links" aria-label="Opciones de cuenta">
        <RouterLink v-if="page!=='login'" to="/login">Volver al ingreso</RouterLink>
        <RouterLink v-if="page==='login'" to="/register">Crear cuenta</RouterLink>
        <RouterLink v-if="page==='login'" to="/recover">¿Olvidaste la contraseña?</RouterLink>
      </nav>
      <RouterLink class="auth-back-link" to="/">Volver al catálogo</RouterLink>
    </div>
  </section>
</template>
