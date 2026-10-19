<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ApiError } from '../api';
import { useSession } from '../session';
import { currencyOptions, pricePeriodOptions, rentalDurationOptions, type Currency, type PricePeriod, type RentalDuration } from './rental-domain';

type Owner = { id:string; email:string };
type Listing = { id:string; title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number; status:'DRAFT'|'REJECTED'|'SUBMITTED'|'APPROVED'; publicationStatus:'UNPUBLISHED'|'PUBLISHED'; availabilityStatus:'AVAILABLE'|'UNAVAILABLE'; lastConfirmedAt:string|null; rejectionReason:string|null; updatedAt:string; owner:{id:string;email:string;role:'OWNER'}; images:{id:string;originalName:string;contentType:string;sizeBytes:number;position:number;url?:string}[] };
type DraftSummary = Pick<Listing,'id'|'title'|'status'>;
type DraftPage = { items:DraftSummary[]; nextCursor:{updatedAt:string;id:string}|null };
type Fields = { title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number };
const session=useSession(),owners=ref<Owner[]>([]),drafts=ref<DraftSummary[]>([]),draftsNextCursor=ref<DraftPage['nextCursor']>(null),loading=ref(true),busy=ref(false),error=ref(''),notice=ref(''),created=ref<Listing|null>(null),ownerSearch=ref(''),ownerMatches=ref(0),draftsLoading=ref(false),staleDraft=ref(false);
const blank=():Fields=>({title:'',description:'',location:'Uspallata',priceAmount:0,currency:'ARS',pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:1});
const form=reactive({...blank(),ownerId:''});
let draftsRequestGeneration=0;
let pendingCreate:{fingerprint:string;key:string}|null=null;
let pendingMutation:{action:string;fingerprint:string;key:string}|null=null;
const editable=()=>!created.value||['DRAFT','REJECTED'].includes(created.value.status);
const listingFields=(value:Fields)=>({title:value.title,description:value.description,location:value.location,priceAmount:value.priceAmount,currency:value.currency,pricePeriod:value.pricePeriod,rentalDuration:value.rentalDuration,maxOccupants:value.maxOccupants});
const hasUnsavedChanges=computed(()=>!!created.value&&editable()&&JSON.stringify(listingFields(form))!==JSON.stringify(listingFields(created.value)));
const statusLabel=(status:string)=>({DRAFT:'Borrador',REJECTED:'Rechazada',SUBMITTED:'En revisión',APPROVED:'Aprobada'}[status]??status);
function assignListing(item:Listing){created.value=item;staleDraft.value=false;form.ownerId=item.owner.id;Object.assign(form,{title:item.title,description:item.description,location:item.location,priceAmount:item.priceAmount,currency:item.currency,pricePeriod:item.pricePeriod,rentalDuration:item.rentalDuration,maxOccupants:item.maxOccupants});}
async function loadDrafts(append=false){
  const ownerId=form.ownerId,cursor=append?draftsNextCursor.value:null;
  if(!ownerId||append&&!cursor){drafts.value=[];draftsNextCursor.value=null;return;}
  const generation=++draftsRequestGeneration;
  draftsLoading.value=true;error.value='';
  try{
    const query=new URLSearchParams({ownerId});
    if(cursor){query.set('afterUpdatedAt',cursor.updatedAt);query.set('afterId',cursor.id);}
    const page=await session.apiRequest<DraftPage>(`/admin/listings/assisted?${query}`);
    if(generation!==draftsRequestGeneration||ownerId!==form.ownerId)return;
    drafts.value=append?[...drafts.value,...page.items.filter(item=>!drafts.value.some(existing=>existing.id===item.id))]:page.items;
    draftsNextCursor.value=page.nextCursor;
  }
  catch(e){if(generation===draftsRequestGeneration&&ownerId===form.ownerId)error.value=e instanceof Error?e.message:'No pudimos cargar los borradores asistidos.';}
  finally{if(generation===draftsRequestGeneration)draftsLoading.value=false;}
}
async function searchOwners(){
  loading.value=true;error.value='';
  const previous=owners.value.find(owner=>owner.id===form.ownerId);
  try{const result=await session.apiRequest<Owner[]>(`/admin/owners${ownerSearch.value.trim()?`?search=${encodeURIComponent(ownerSearch.value.trim())}`:''}`);ownerMatches.value=result.length;owners.value=previous&&!result.some(owner=>owner.id===previous.id)?[previous,...result]:result;if(!form.ownerId)form.ownerId=result[0]?.id??'';}
  catch{error.value='No pudimos buscar las cuentas OWNER.';}
  finally{loading.value=false;}
}
watch(()=>form.ownerId,()=>{draftsRequestGeneration++;created.value=null;drafts.value=[];draftsNextCursor.value=null;void loadDrafts();});
onMounted(()=>void searchOwners());
function newDraft(){created.value=null;staleDraft.value=false;Object.assign(form,blank(),{ownerId:form.ownerId});pendingMutation=null;pendingCreate=null;notice.value='';error.value='';}
async function create(){
  if(busy.value||!form.ownerId)return;
  busy.value=true;error.value='';notice.value='';
  const body={...form},fingerprint=JSON.stringify(body);
  if(pendingCreate?.fingerprint!==fingerprint)pendingCreate={fingerprint,key:crypto.randomUUID()};
  try{const item=await session.apiRequest<Listing>('/admin/listings/assisted',{method:'POST',body:JSON.stringify(body),headers:{'Idempotency-Key':pendingCreate.key}});pendingCreate=null;assignListing(item);await loadDrafts();notice.value='Borrador asistido creado y registrado en auditoría.';}
  catch(e){error.value=e instanceof Error?e.message:'No se pudo crear el borrador asistido.';}
  finally{busy.value=false;}
}
async function openDraft(id:string){
  if(busy.value)return;
  busy.value=true;error.value='';notice.value='';
  try{const item=await session.apiRequest<Listing>(`/admin/listings/${encodeURIComponent(id)}`);assignListing(item);}
  catch(e){error.value=e instanceof Error?e.message:'No se pudo abrir el borrador asistido.';}
  finally{busy.value=false;}
}
function openDraftFromEvent(event:Event){const id=(event.target as HTMLSelectElement).value;if(id)void openDraft(id);}
async function mutate(action:string,path:string,method:string,body?:unknown){
  if(busy.value||!created.value)return;
  const listingId=created.value.id,payload=body===undefined?null:body,fingerprint=JSON.stringify({listingId,payload});
  if(pendingMutation?.action!==action||pendingMutation.fingerprint!==fingerprint)pendingMutation={action,fingerprint,key:crypto.randomUUID()};
  busy.value=true;error.value='';notice.value='';
  try{const item=await session.apiRequest<Listing>(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)}),headers:{'Idempotency-Key':pendingMutation.key}});pendingMutation=null;if(action==='delete'){created.value=null;Object.assign(form,blank(),{ownerId:form.ownerId});}else assignListing(item);await loadDrafts();notice.value=action==='edit'?'Cambios guardados y auditados.':action==='availability'?'Disponibilidad actualizada y auditada.':action==='reconfirm'?'Disponibilidad reconfirmada y auditada.':action==='submit'?'Publicación enviada a revisión y auditada.':'Borrador eliminado y auditado.';}
  catch(e){if(action==='edit'&&e instanceof ApiError&&e.status===409)staleDraft.value=true;error.value=e instanceof ApiError&&e.status===409?'La publicación cambió o la acción no está permitida. Recargá la versión actual antes de continuar.':e instanceof Error?e.message:'No se pudo confirmar la operación.';}
  finally{busy.value=false;}
}
async function save(){if(staleDraft.value)return;if(!created.value){await create();return;}await mutate('edit',`/admin/listings/assisted/${encodeURIComponent(created.value.id)}`,'PATCH',{title:form.title,description:form.description,location:form.location,priceAmount:form.priceAmount,currency:form.currency,pricePeriod:form.pricePeriod,rentalDuration:form.rentalDuration,maxOccupants:form.maxOccupants,expectedUpdatedAt:created.value.updatedAt});}
async function refreshCurrent(){const item=created.value;if(!item||busy.value)return;busy.value=true;error.value='';try{assignListing(await session.apiRequest<Listing>(`/admin/listings/${encodeURIComponent(item.id)}`));notice.value='Se recargó la versión actual del borrador.';}catch(e){error.value=e instanceof Error?e.message:'No se pudo recargar el borrador.';}finally{busy.value=false;}}
async function toggleAvailability(){const item=created.value;if(!item)return;const availabilityStatus=item.availabilityStatus==='AVAILABLE'?'UNAVAILABLE':'AVAILABLE';await mutate('availability',`/admin/listings/assisted/${encodeURIComponent(item.id)}/availability`,'PATCH',{availabilityStatus});}
async function reconfirm(){const item=created.value;if(item)await mutate('reconfirm',`/admin/listings/assisted/${encodeURIComponent(item.id)}/reconfirm`,'POST');}
async function submit(){const item=created.value;if(item)await mutate('submit',`/admin/listings/assisted/${encodeURIComponent(item.id)}/submit`,'POST');}
async function remove(){
  const item=created.value;if(!item||busy.value)return;
  if(!window.confirm(`¿Eliminar definitivamente “${item.title}” y sus imágenes? Esta acción se registrará en auditoría.`))return;
  await mutate('delete',`/admin/listings/assisted/${encodeURIComponent(item.id)}`,'DELETE');
}
</script>

<template>
  <section class="admin-review">
    <p class="eyebrow">Área ADMIN</p>
    <h2>Gestión asistida</h2>
    <p>Administrá borradores para una cuenta OWNER. La persona propietaria conserva el control de la publicación y el envío a revisión.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="loading" role="status">Cargando cuentas OWNER…</p>
    <section v-else class="card assisted-create">
      <label>Buscar por correo OWNER<input v-model="ownerSearch" type="search" maxlength="254" autocomplete="off" @keydown.enter.prevent="searchOwners" /></label>
      <button type="button" class="secondary" :disabled="busy" @click="searchOwners">Buscar cuentas</button>
      <p v-if="ownerSearch.trim()&&ownerMatches===0">No hay coincidencias. Probá con otra parte del correo.</p>
      <p v-else-if="ownerMatches===50">Se muestran hasta 50 coincidencias; refiná la búsqueda si hace falta.</p>
      <label>Cuenta OWNER<select v-model="form.ownerId" :disabled="busy||!!created" required><option value="" disabled>Elegí una cuenta</option><option v-for="owner in owners" :key="owner.id" :value="owner.id">{{ owner.email }}</option></select></label>
      <label v-if="drafts.length">Borrador asistido existente<select :disabled="busy||hasUnsavedChanges" @change="openDraftFromEvent"><option value="">Elegí un borrador para administrarlo</option><option v-for="item in drafts" :key="item.id" :value="item.id">{{ item.title }} · {{ statusLabel(item.status) }}</option></select></label>
      <button v-if="draftsNextCursor" type="button" class="secondary" :disabled="busy||draftsLoading" @click="loadDrafts(true)">Cargar más borradores</button>
      <p v-if="draftsLoading" role="status">Cargando borradores…</p>
      <p v-else-if="form.ownerId&&!drafts.length&&!created">No hay borradores asistidos pendientes para esta cuenta.</p>
      <button v-if="created" type="button" class="secondary" :disabled="busy||hasUnsavedChanges" @click="newDraft">Crear otro borrador asistido</button>
      <form v-if="form.ownerId" @submit.prevent="save" :aria-busy="busy">
        <fieldset :disabled="busy||!editable()||staleDraft">
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
          <button type="submit">{{ busy?'Guardando…':created?'Guardar cambios':'Crear borrador asistido' }}</button>
        </fieldset>
      </form>
      <article v-if="created" class="subsection" aria-labelledby="assisted-current-title">
        <h3 id="assisted-current-title">{{ created.title }}</h3>
        <button v-if="staleDraft" type="button" class="secondary" :disabled="busy" @click="refreshCurrent">Recargar versión actual (descarta mis cambios)</button>
        <p>Propietario: {{ created.owner.email }} · Estado: {{ statusLabel(created.status) }}</p>
        <p>Disponibilidad: {{ created.availabilityStatus==='AVAILABLE'?'Disponible':'No disponible' }} · última confirmación: {{ created.lastConfirmedAt?new Date(created.lastConfirmedAt).toLocaleString('es-AR'):'Sin confirmar' }}</p>
        <p v-if="hasUnsavedChanges" class="notice" role="status">Guardá los cambios antes de cambiar disponibilidad, enviar o eliminar este borrador.</p>
        <div v-if="['DRAFT','REJECTED'].includes(created.status)" class="session-actions"><button type="button" :disabled="busy||hasUnsavedChanges" @click="toggleAvailability">{{ created.availabilityStatus==='AVAILABLE'?'Marcar no disponible':'Marcar disponible' }}</button><button type="button" class="secondary" :disabled="busy||hasUnsavedChanges" @click="reconfirm">Reconfirmar disponibilidad</button></div>
        <div v-if="['DRAFT','REJECTED'].includes(created.status)" class="session-actions"><button type="button" :disabled="busy||hasUnsavedChanges" @click="submit">Enviar a revisión</button><button type="button" class="secondary" :disabled="busy||hasUnsavedChanges" @click="remove">Eliminar borrador asistido</button></div>
        <p v-else-if="created.status==='SUBMITTED'">El borrador ya está en revisión. Las decisiones de moderación siguen en la pantalla de ADMIN.</p>
        <RouterLink to="/admin">Abrir revisión y auditoría ADMIN</RouterLink>
      </article>
    </section>
  </section>
</template>
