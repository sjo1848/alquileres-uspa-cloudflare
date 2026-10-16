<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ApiError } from '../api';
import { useSession } from '../session';
import { currencyOptions, pricePeriodOptions, rentalDurationOptions, formatRentalPrice, type Currency, type PricePeriod, type RentalDuration } from './rental-domain';
type Fields = { title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number };
type Listing = Fields & { id:string; status:'DRAFT'|'REJECTED'|'SUBMITTED'|'APPROVED'; rejectionReason:string|null; publicationStatus:string };
const session=useSession(), listings=ref<Listing[]>([]), selectedId=ref<string|null>(null);
const busy=ref(false), loading=ref(true), error=ref(''), notice=ref('');
const confirmReload=ref(false);
const pendingSelection=ref<{item?:Listing}|null>(null);
const blank=():Fields=>({title:'',description:'',location:'Uspallata',priceAmount:0,currency:'ARS',pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:1});
const form=reactive<Fields>(blank());
const selected=computed(()=>listings.value.find(x=>x.id===selectedId.value));
const canEdit=computed(()=>!selected.value||['DRAFT','REJECTED'].includes(selected.value.status));
const dirty=computed(()=>selected.value&&Object.keys(blank()).some(key=>form[key as keyof Fields]!==selected.value![key as keyof Fields]));
const unsaved=computed(()=>{
  const baseline=selected.value??blank();
  return Object.keys(blank()).some(key=>form[key as keyof Fields]!==baseline[key as keyof Fields]);
});
let pendingCreate:{body:string;key:string}|undefined;
const label=(status:string)=>({DRAFT:'Borrador',REJECTED:'Rechazada',SUBMITTED:'En revisión',APPROVED:'Aprobada'}[status]??status);
function message(e:unknown){
  if(e instanceof ApiError&&e.status===400)return 'Completá los campos obligatorios de la publicación y guardá los cambios antes de enviarla.';
  if(e instanceof ApiError&&e.status===409)return 'La publicación cambió. Recargá tus publicaciones antes de reintentar.';
  if(e instanceof ApiError&&e.status===404)return 'La publicación ya no está disponible para editar.';
  return 'No pudimos confirmar la operación. Reintentá con los mismos datos.';
}
function choose(item?:Listing){
  if(busy.value)return;
  selectedId.value=item?.id??null;
  Object.assign(form,item?Object.fromEntries(Object.keys(blank()).map(key=>[key,item[key as keyof Fields]])):blank());
  error.value='';notice.value='';pendingCreate=undefined;
  confirmReload.value=false;
  pendingSelection.value=null;
}
function requestChoose(item?:Listing){
  if(busy.value)return;
  if(unsaved.value){pendingSelection.value={item};confirmReload.value=false;return;}
  choose(item);
}
function confirmChoose(){if(pendingSelection.value)choose(pendingSelection.value.item);}
async function load(discardChanges=false){
  if(busy.value)return;
  pendingSelection.value=null;
  if(dirty.value&&discardChanges!==true){confirmReload.value=true;return;}
  confirmReload.value=false;
  loading.value=true;error.value='';
  try{
    const selected=selectedId.value;
    listings.value=await session.apiRequest<Listing[]>('/listings');
    if(selected){
      const refreshed=listings.value.find(item=>item.id===selected);
      choose(refreshed);
      if(!refreshed)notice.value='La publicación seleccionada ya no está disponible.';
    }
  }
  catch(e){error.value=message(e);}
  finally{loading.value=false;}
}
function remember(item:Listing){
  const index=listings.value.findIndex(x=>x.id===item.id);
  if(index<0)listings.value.unshift(item);else listings.value[index]=item;
  selectedId.value=item.id;Object.assign(form,Object.fromEntries(Object.keys(blank()).map(key=>[key,item[key as keyof Fields]])));
}
async function save(){
  if(busy.value||loading.value||!canEdit.value)return;
  busy.value=true;error.value='';notice.value='';
  const existing=selectedId.value,body=JSON.stringify({...form});
  try{
    if(!existing&&pendingCreate?.body!==body)pendingCreate={body,key:crypto.randomUUID()};
    const item=await session.apiRequest<Listing>(existing?`/listings/${encodeURIComponent(existing)}`:'/listings',{
      method:existing?'PATCH':'POST',body,
      headers:existing?{}:{'Idempotency-Key':pendingCreate!.key},
    });
    remember(item);pendingCreate=undefined;notice.value=existing?'Cambios guardados.':'Borrador creado.';
  }catch(e){error.value=message(e);}
  finally{busy.value=false;}
}
async function submit(){
  if(!selected.value||busy.value||!canEdit.value||dirty.value)return;
  busy.value=true;error.value='';notice.value='';
  try{
    const item=await session.apiRequest<Listing>(`/listings/${encodeURIComponent(selected.value.id)}/submit`,{method:'POST'});
    remember(item);notice.value='Publicación enviada a revisión.';
  }catch(e){error.value=message(e);}
  finally{busy.value=false;}
}
onMounted(()=>load());
</script>
<template>
  <section>
    <p class="eyebrow">Área de propietarios</p><h2>Mis publicaciones</h2>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="success" role="status">{{ notice }}</p>
    <button class="secondary" :disabled="busy||loading" @click="load()">Recargar publicaciones</button>
    <div v-if="confirmReload" class="notice" role="status">
      <p>Tenés cambios sin guardar. ¿Querés descartarlos y cargar la versión guardada?</p>
      <button :disabled="busy||loading" @click="load(true)">Descartar cambios y recargar</button>
      <button class="secondary" @click="confirmReload=false">Seguir editando</button>
    </div>
    <div v-if="pendingSelection" class="notice" role="status">
      <p>Tenés cambios sin guardar. ¿Querés descartarlos y cambiar de publicación?</p>
      <button :disabled="busy||loading" @click="confirmChoose">Descartar cambios y cambiar</button>
      <button class="secondary" @click="pendingSelection=null">Seguir editando</button>
    </div>
    <p v-if="loading" role="status">Cargando tus publicaciones…</p>
    <div v-else class="owner-layout">
      <aside class="card">
        <button :disabled="busy" @click="requestChoose()">+ Nuevo borrador</button>
        <p v-if="!listings.length">Todavía no tenés publicaciones.</p>
        <button v-for="item in listings" :key="item.id" type="button" class="listing-choice" :class="{selected:selectedId===item.id}" :disabled="busy" @click="requestChoose(item)">
          <strong>{{ item.title }}</strong><span>{{ label(item.status) }}</span>
        </button>
      </aside>
      <article class="card editor">
        <h3>{{ selected ? 'Tu publicación' : 'Nuevo borrador' }}</h3>
        <p v-if="selected" class="status">{{ label(selected.status) }}</p>
        <p v-if="selected?.rejectionReason" class="error">Motivo: {{ selected.rejectionReason }}</p>
        <form @submit.prevent="save" :aria-busy="busy">
          <fieldset :disabled="busy||!canEdit">
            <label>Título<input v-model="form.title" required maxlength="120" /></label>
            <label>Descripción<textarea v-model="form.description" maxlength="5000" rows="4" /></label>
            <label>Ubicación<input v-model="form.location" required maxlength="240" /></label>
            <div class="form-row">
              <label>Importe<input v-model.number="form.priceAmount" type="number" min="0" max="2147483647" step="1" required /></label>
              <label>Moneda<select v-model="form.currency"><option v-for="o in currencyOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
              <label>Periodicidad<select v-model="form.pricePeriod"><option v-for="o in pricePeriodOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
              <label>Duración<select v-model="form.rentalDuration"><option v-for="o in rentalDurationOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
              <label>Ocupantes máximos<input v-model.number="form.maxOccupants" type="number" min="1" max="2147483647" step="1" required /></label>
            </div>
            <button type="submit">{{ busy?'Guardando…':selected?'Guardar cambios':'Crear borrador' }}</button>
          </fieldset>
        </form>
        <div v-if="selected" class="subsection">
          <p>{{ formatRentalPrice(selected) }}</p>
          <p v-if="canEdit&&dirty" class="notice">Guardá los cambios antes de enviar a revisión.</p>
          <button v-if="canEdit" :disabled="busy||dirty" @click="submit">Enviar a revisión</button>
          <p v-else-if="selected.status==='SUBMITTED'">Tu publicación está en revisión.</p>
          <RouterLink v-if="selected.status==='APPROVED'&&selected.publicationStatus==='PUBLISHED'" :to="`/listings/${selected.id}`">Ver ficha publicada</RouterLink>
        </div>
        <p class="notice">Por ahora, el equipo gestiona las imágenes de las publicaciones.</p>
      </article>
    </div>
  </section>
</template>
