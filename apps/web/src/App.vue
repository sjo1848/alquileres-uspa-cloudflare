<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from './session';
const session=useSession(),router=useRouter(),loggingOut=ref(false),logoutError=ref('');
onMounted(()=>{void session.loadAuthStrategy().catch(()=>{});});
async function logout(){
  if(loggingOut.value)return;
  loggingOut.value=true;logoutError.value='';
  try{await session.clear();await router.push('/');}
  catch{logoutError.value='No pudimos cerrar la sesión. Reintentá.';}
  finally{loggingOut.value=false;}
}
async function switchDemoIdentity(){
  if(loggingOut.value)return;
  loggingOut.value=true;logoutError.value='';
  try{await session.clear();await router.push('/login');}
  catch{logoutError.value='No pudimos cambiar la identidad de prueba. Reintentá.';}
  finally{loggingOut.value=false;}
}
</script>
<template>
  <a class="skip-link" href="#main-content">Saltar al contenido</a>
  <header class="site-header">
    <h1><RouterLink to="/">Alquileres Uspallata</RouterLink></h1>
    <p class="site-caption">Propiedades y alquileres en Uspallata</p>
    <nav class="session-actions" aria-label="Navegación principal">
      <RouterLink to="/">Catálogo</RouterLink>
      <RouterLink v-if="session.role.value==='OWNER'" to="/owner">Mis publicaciones</RouterLink>
      <RouterLink v-if="session.role.value==='ADMIN'" to="/admin">Revisión</RouterLink>
      <RouterLink v-if="session.role.value==='ADMIN'" to="/admin-assist">Gestión asistida</RouterLink>
      <button v-if="session.isAuthenticated.value&&session.authStrategy.value==='ACCESS_PREVIEW'" class="secondary" :disabled="loggingOut" @click="switchDemoIdentity">Cambiar perfil de prueba</button>
      <button v-if="session.isAuthenticated.value" class="secondary" :disabled="loggingOut" @click="logout">{{ loggingOut?'Cerrando sesión…':'Cerrar sesión' }}</button>
      <RouterLink v-else to="/login">Ingresar como propietario</RouterLink>
    </nav>
    <p v-if="logoutError" class="error" role="alert">{{ logoutError }}</p>
  </header>
  <main id="main-content" tabindex="-1"><RouterView /></main>
  <footer>Alquileres Uspallata</footer>
</template>
