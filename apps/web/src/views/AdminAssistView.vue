<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useSession } from '../session';
import { currencyOptions, pricePeriodOptions, rentalDurationOptions, type Currency, type PricePeriod, type RentalDuration } from './rental-domain';

type Owner = { id:string; email:string };
type CreatedListing = { id:string; title:string; status:string; owner:{email:string} };
const session=useSession(), owners=ref<Owner[]>([]), loading=ref(true), busy=ref(false), error=ref(''), notice=ref(''), created=ref<CreatedListing|null>(null);
const form=reactive({ownerId:'',title:'',description:'',location:'Uspallata',priceAmount:0,currency:'ARS' as Currency,pricePeriod:'MONTH' as PricePeriod,rentalDuration:'FLEXIBLE' as RentalDuration,maxOccupants:1});
onMounted(async()=>{try{owners.value=await session.apiRequest<Owner[]>('/admin/owners');form.ownerId=owners.value[0]?.id??'';}catch{error.value='No pudimos cargar las cuentas OWNER.';}finally{loading.value=false;}});
async function create(){if(busy.value||!form.ownerId)return;busy.value=true;error.value='';notice.value='';created.value=null;try{created.value=await session.apiRequest<CreatedListing>('/admin/listings/assisted',{method:'POST',body:JSON.stringify({...form})});notice.value='Borrador asistido creado y registrado en auditoría.';}catch(e){error.value=e instanceof Error?e.message:'No se pudo crear el borrador asistido.';}finally{busy.value=false;}}
</script>

<template>
  <section class="admin-review">
    <p class="eyebrow">Área ADMIN</p>
    <h2>Gestión asistida</h2>
    <p>Creá un borrador sintético para una cuenta OWNER. La persona propietaria conserva el control de la publicación y el envío a revisión.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="loading" role="status">Cargando cuentas OWNER…</p>
    <section v-else class="card assisted-create">
      <p v-if="!owners.length">No hay cuentas OWNER disponibles.</p>
      <form v-else @submit.prevent="create" :aria-busy="busy">
        <fieldset :disabled="busy">
          <label>Cuenta OWNER<select v-model="form.ownerId" required><option v-for="owner in owners" :key="owner.id" :value="owner.id">{{ owner.email }}</option></select></label>
          <label>Título<input v-model="form.title" required maxlength="120" /></label>
          <label>Descripción<textarea v-model="form.description" maxlength="5000" rows="4"></textarea></label>
          <label>Ubicación<input v-model="form.location" required maxlength="240" /></label>
          <div class="form-row">
            <label>Importe<input v-model.number="form.priceAmount" type="number" min="0" max="2147483647" step="1" required /></label>
            <label>Moneda<select v-model="form.currency"><option v-for="option in currencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label>Periodicidad<select v-model="form.pricePeriod"><option v-for="option in pricePeriodOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label>Duración<select v-model="form.rentalDuration"><option v-for="option in rentalDurationOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label>Ocupantes máximos<input v-model.number="form.maxOccupants" type="number" min="1" max="2147483647" step="1" required /></label>
          </div>
          <button type="submit">{{ busy?'Creando…':'Crear borrador asistido' }}</button>
        </fieldset>
      </form>
    </section>
    <article v-if="created" class="card">
      <h3>{{ created.title }}</h3>
      <p>Propietario: {{ created.owner.email }}</p>
      <p>Estado: borrador. El registro quedó en la auditoría ADMIN.</p>
      <RouterLink to="/admin">Ir a revisión de publicaciones</RouterLink>
    </article>
  </section>
</template>
