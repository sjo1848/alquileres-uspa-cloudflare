<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { apiUrl, ApiError } from '../api';
import { useSession } from '../session';
import { currencyOptions, pricePeriodOptions, rentalDurationOptions, type Currency, type PricePeriod, type RentalDuration } from './rental-domain';
import { adminActionLabel, formatAdminTimestamp } from './admin-display';
import { availabilityLabel, freshnessLabel, type FreshnessStatus } from './availability-helpers';

type Owner = { id:string; email:string };
type Listing = { id:string; title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number; status:'DRAFT'|'REJECTED'|'SUBMITTED'|'APPROVED'; publicationStatus:'UNPUBLISHED'|'PUBLISHED'; availabilityStatus:'AVAILABLE'|'UNAVAILABLE'; freshnessStatus?:FreshnessStatus; lastConfirmedAt:string|null; rejectionReason:string|null; updatedAt:string; owner:{id:string;email:string;role:'OWNER'}; images:{id:string;originalName:string;contentType:string;sizeBytes:number;position:number;url?:string}[] };
type DraftSummary = Pick<Listing,'id'|'title'|'status'>;
type DraftPage = { items:DraftSummary[]; nextCursor:{updatedAt:string;id:string}|null };
type Audit = {id:string;action:string;reason:string|null;createdAt:string;actor:{email:string};targetOwner:{email:string}|null};
type Fields = { title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number };
const session=useSession(),owners=ref<Owner[]>([]),drafts=ref<DraftSummary[]>([]),draftsNextCursor=ref<DraftPage['nextCursor']>(null),loading=ref(true),busy=ref(false),error=ref(''),notice=ref(''),created=ref<Listing|null>(null),ownerSearch=ref(''),ownerMatches=ref(0),draftsLoading=ref(false),staleDraft=ref(false),audit=ref<Audit[]>([]),auditLoading=ref(false),section=ref<'details'|'photos'|'availability'|'audit'>('details');
const blank=():Fields=>({title:'',description:'',location:'Uspallata',priceAmount:0,currency:'ARS',pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:1});
const form=reactive({...blank(),ownerId:''});
let draftsRequestGeneration=0;
let auditRequestGeneration=0;
let pendingCreate:{fingerprint:string;key:string}|null=null;
let pendingMutation:{action:string;fingerprint:string;key:string}|null=null;
const editable=()=>!created.value||['DRAFT','REJECTED'].includes(created.value.status);
const listingFields=(value:Fields)=>({title:value.title,description:value.description,location:value.location,priceAmount:value.priceAmount,currency:value.currency,pricePeriod:value.pricePeriod,rentalDuration:value.rentalDuration,maxOccupants:value.maxOccupants});
const originalFields=ref<string>(JSON.stringify(blank()));
const hasUnsavedChanges=computed(()=>editable()&&JSON.stringify(listingFields(form))!==originalFields.value);
const statusLabel=(status:string)=>({DRAFT:'Borrador',REJECTED:'Rechazada',SUBMITTED:'En revisión',APPROVED:'Aprobada'}[status]??status);
function resetAudit(){auditRequestGeneration++;audit.value=[];auditLoading.value=false;}
function assignListing(item:Listing,resetSection=true){created.value=item;resetAudit();staleDraft.value=false;form.ownerId=item.owner.id;Object.assign(form,{title:item.title,description:item.description,location:item.location,priceAmount:item.priceAmount,currency:item.currency,pricePeriod:item.pricePeriod,rentalDuration:item.rentalDuration,maxOccupants:item.maxOccupants});originalFields.value=JSON.stringify(listingFields(form));if(resetSection)section.value='details';void loadAudit(item.id);}
function imageSrc(url?:string){return !url?'':url.startsWith('/media/catalog/')?url:apiUrl(url);}
function protectUnsavedBeforeUnload(event:BeforeUnloadEvent){if(!hasUnsavedChanges.value)return;event.preventDefault();event.returnValue='';}
async function loadAudit(listingId=created.value?.id){const generation=++auditRequestGeneration;if(!listingId){audit.value=[];auditLoading.value=false;return;}auditLoading.value=true;try{const result=await session.apiRequest<Audit[]>(`/admin/listings/audit?limit=30&listingId=${encodeURIComponent(listingId)}`);if(generation===auditRequestGeneration&&created.value?.id===listingId)audit.value=result;}catch{if(generation===auditRequestGeneration&&created.value?.id===listingId)audit.value=[];}finally{if(generation===auditRequestGeneration)auditLoading.value=false;}}
function selectOwner(event:Event){const next=(event.target as HTMLSelectElement).value;if(next===form.ownerId)return;if(hasUnsavedChanges.value&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos y cambiar de propietario?')){(event.target as HTMLSelectElement).value=form.ownerId;return;}form.ownerId=next;created.value=null;resetAudit();staleDraft.value=false;Object.assign(form,blank(),{ownerId:next});originalFields.value=JSON.stringify(listingFields(form));}
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
onBeforeRouteLeave(()=>{if(!hasUnsavedChanges.value)return true;return window.confirm('Tenés cambios sin guardar. ¿Salir y descartarlos?');});
onMounted(()=>{window.addEventListener('beforeunload',protectUnsavedBeforeUnload);void searchOwners();});
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',protectUnsavedBeforeUnload);resetAudit();});
function newDraft(){if(hasUnsavedChanges.value&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos y crear otro borrador?'))return;created.value=null;resetAudit();staleDraft.value=false;Object.assign(form,blank(),{ownerId:form.ownerId});originalFields.value=JSON.stringify(listingFields(form));section.value='details';pendingMutation=null;pendingCreate=null;notice.value='';error.value='';}
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
  try{const item=await session.apiRequest<Listing>(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)}),headers:{'Idempotency-Key':pendingMutation.key}});pendingMutation=null;if(action==='delete'){created.value=null;resetAudit();Object.assign(form,blank(),{ownerId:form.ownerId});originalFields.value=JSON.stringify(listingFields(form));section.value='details';}else assignListing(item,false);await loadDrafts();notice.value=action==='edit'?'Cambios guardados y auditados.':action==='availability'?'Disponibilidad actualizada y auditada.':action==='reconfirm'?'Disponibilidad reconfirmada y auditada.':action==='submit'?'Publicación enviada a revisión y auditada.': 'Borrador eliminado y auditado.';}
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
  <section class="admin-workspace admin-assist-page" aria-labelledby="assist-title">
    <header class="admin-page-heading"><div><p class="admin-eyebrow">Administración · acompañamiento</p><h1 id="assist-title">Gestión asistida</h1><p>Gestioná publicaciones con el propietario; sus decisiones y permisos se mantienen separados.</p></div><RouterLink to="/admin" class="admin-button admin-button-secondary">Ir a moderación</RouterLink></header>
    <p v-if="error" class="admin-feedback is-error" role="alert">{{ error }}</p><p v-if="notice" class="admin-feedback is-success" role="status">{{ notice }}</p>
    <div v-if="loading" role="status" class="admin-muted-note">Cargando cuentas OWNER…</div>
    <div v-else class="admin-assist-layout">
      <aside class="admin-assist-sidebar" aria-label="Selección de cuenta y publicación">
        <div class="admin-assist-owner-search"><label for="owner-search">Buscar cuenta OWNER</label><div><input id="owner-search" v-model="ownerSearch" type="search" maxlength="254" autocomplete="off" @keydown.enter.prevent="searchOwners"/><button class="admin-button admin-button-secondary" type="button" :disabled="busy" @click="searchOwners">Buscar</button></div></div>
        <p v-if="ownerSearch.trim()&&ownerMatches===0" class="admin-muted-note">No hay coincidencias. Probá con otra parte del correo.</p><p v-else-if="ownerMatches===50" class="admin-muted-note">Se muestran hasta 50 coincidencias; refiná la búsqueda.</p>
        <label class="admin-field"><span>Cuenta OWNER</span><select :value="form.ownerId" :disabled="busy||!!created" required @change="selectOwner"><option value="" disabled>Elegí una cuenta</option><option v-for="owner in owners" :key="owner.id" :value="owner.id">{{ owner.email }}</option></select></label>
        <label v-if="drafts.length" class="admin-field"><span>Publicación asistida</span><select :disabled="busy||hasUnsavedChanges" @change="openDraftFromEvent"><option value="">Elegí un borrador</option><option v-for="item in drafts" :key="item.id" :value="item.id">{{ item.title }} · {{ statusLabel(item.status) }}</option></select></label>
        <button v-if="draftsNextCursor" class="admin-button admin-button-secondary" type="button" :disabled="busy||draftsLoading" @click="loadDrafts(true)">Cargar más borradores</button>
        <p v-if="draftsLoading" class="admin-muted-note" role="status">Cargando publicaciones…</p><p v-else-if="form.ownerId&&!drafts.length&&!created" class="admin-muted-note">No hay borradores asistidos pendientes.</p>
        <button v-if="created" class="admin-button admin-button-secondary" type="button" :disabled="busy" @click="newDraft">Crear otro borrador</button>
        <div v-if="created" class="admin-assist-current"><span class="admin-eyebrow">En gestión</span><strong>{{ created.title }}</strong><span class="admin-status-pill" :class="created.status==='SUBMITTED'?'is-review':created.status==='REJECTED'?'is-rejected':'is-approved'">{{ statusLabel(created.status) }}</span></div>
      </aside>
      <article class="admin-assist-editor">
        <header class="admin-assist-heading"><div><p class="admin-eyebrow">Propietario · publicación</p><h2>{{ created?.title || 'Nuevo borrador' }}</h2><p>El propietario conserva la carga de fotos y el control del envío a revisión.</p></div></header>
        <p v-if="hasUnsavedChanges" class="admin-data-warning" role="status"><strong>Cambios sin guardar</strong><span>Guardá antes de cambiar de sección, cuenta o estado.</span></p>
        <button v-if="staleDraft" class="admin-button admin-button-secondary" type="button" :disabled="busy" @click="refreshCurrent">Recargar la versión actual y descartar mis cambios</button>
        <nav v-if="created" class="admin-assist-tabs" aria-label="Secciones de la publicación">
          <button type="button" :aria-current="section==='details'?'page':undefined" @click="section='details'">Información</button><button type="button" :aria-current="section==='photos'?'page':undefined" @click="section='photos'">Fotografías</button><button type="button" :aria-current="section==='availability'?'page':undefined" @click="section='availability'">Disponibilidad</button><button type="button" :aria-current="section==='audit'?'page':undefined" @click="section='audit'">Auditoría</button>
        </nav>
        <section v-if="section==='details'||!created" class="admin-assist-section" aria-label="Información de la publicación">
          <form v-if="form.ownerId" @submit.prevent="save" :aria-busy="busy"><fieldset :disabled="busy||!editable()||staleDraft"><div class="admin-assist-form-grid">
            <label class="admin-field admin-field-wide"><span>Título</span><input v-model="form.title" required maxlength="120"/></label><label class="admin-field admin-field-wide"><span>Descripción</span><textarea v-model="form.description" maxlength="5000" rows="5"></textarea></label><label class="admin-field admin-field-wide"><span>Ubicación</span><input v-model="form.location" required maxlength="240"/></label>
            <label class="admin-field"><span>Importe</span><input v-model.number="form.priceAmount" type="number" min="0" max="2147483647" step="1" required/></label><label class="admin-field"><span>Moneda</span><select v-model="form.currency"><option v-for="option in currencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label class="admin-field"><span>Periodicidad</span><select v-model="form.pricePeriod"><option v-for="option in pricePeriodOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label class="admin-field"><span>Duración</span><select v-model="form.rentalDuration"><option v-for="option in rentalDurationOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label class="admin-field"><span>Ocupantes máximos</span><input v-model.number="form.maxOccupants" type="number" min="1" max="2147483647" step="1" required/></label>
          </div><button class="admin-button admin-button-primary" type="submit">{{ busy?'Guardando…':created?'Guardar cambios':'Crear borrador asistido' }}</button></fieldset></form><p v-else class="admin-muted-note">Elegí una cuenta OWNER para crear o gestionar una publicación.</p>
          <p v-if="created&&created.status==='SUBMITTED'" class="admin-feedback is-success">Esta publicación está en revisión. La decisión se realiza desde moderación.</p>
        </section>
        <section v-if="created&&section==='photos'" class="admin-assist-section" aria-label="Fotografías de la publicación"><div class="admin-section-title"><div><p class="admin-eyebrow">Inspección · solo lectura</p><h3>Fotografías</h3></div><span class="admin-count">{{ created.images.length }}</span></div><div v-if="created.images.length" class="admin-review-images"><figure v-for="image in created.images" :key="image.id"><img :src="imageSrc(image.url)" :alt="'Fotografía '+(image.position+1)+' de '+created.title"/><figcaption>Foto {{ image.position+1 }} · {{ image.originalName }} · {{ Math.round(image.sizeBytes/1024) }} KB</figcaption></figure></div><p v-else class="admin-empty-state">No hay fotografías adjuntas.</p><p class="admin-muted-note">La carga, orden y eliminación de fotografías permanecen bajo el control del propietario.</p></section>
        <section v-if="created&&section==='availability'" class="admin-assist-section" aria-label="Disponibilidad y acciones"><div class="admin-section-title"><div><p class="admin-eyebrow">Dato declarado por el propietario</p><h3>Disponibilidad</h3></div></div><div class="admin-availability-card"><strong>{{ availabilityLabel(created.availabilityStatus, created.freshnessStatus??'UNCONFIRMED') }}</strong><span>{{ freshnessLabel(created.freshnessStatus,created.lastConfirmedAt) }} · {{ formatAdminTimestamp(created.lastConfirmedAt) }} · hora de Mendoza</span></div><p v-if="hasUnsavedChanges" class="admin-muted-note">Guardá la información antes de cambiar el estado.</p><div v-if="['DRAFT','REJECTED'].includes(created.status)" class="admin-decision-actions"><button class="admin-button admin-button-secondary" type="button" :disabled="busy||hasUnsavedChanges" @click="toggleAvailability">{{ created.availabilityStatus==='AVAILABLE'?'Marcar no disponible':'Marcar disponible' }}</button><button class="admin-button admin-button-secondary" type="button" :disabled="busy||hasUnsavedChanges" @click="reconfirm">Reconfirmar disponibilidad</button></div><div v-if="['DRAFT','REJECTED'].includes(created.status)" class="admin-decision-actions"><button class="admin-button admin-button-primary" type="button" :disabled="busy||hasUnsavedChanges" @click="submit">Enviar a revisión</button><button class="admin-button admin-button-danger" type="button" :disabled="busy||hasUnsavedChanges" @click="remove">Eliminar borrador</button></div><p v-else class="admin-muted-note">La publicación ya está {{ statusLabel(created.status).toLowerCase() }}.</p></section>
        <section v-if="created&&section==='audit'" class="admin-assist-section" aria-label="Auditoría"><div class="admin-section-title"><div><p class="admin-eyebrow">Trazabilidad</p><h3>Actividad de la publicación</h3></div><button type="button" class="admin-inline-button" :disabled="auditLoading" @click="loadAudit()">{{ auditLoading?'Actualizando…':'Actualizar actividad' }}</button></div><p v-if="auditLoading&&!audit.length" role="status" class="admin-muted-note">Cargando auditoría…</p><p v-else-if="!audit.length" class="admin-muted-note">No hay eventos registrados.</p><ol v-else class="admin-audit-list"><li v-for="entry in audit" :key="entry.id"><span class="admin-audit-mark" aria-hidden="true">✓</span><div><strong>{{ adminActionLabel(entry.action) }}</strong><p>{{ entry.actor.email }}<template v-if="entry.targetOwner"> · publicación de {{ entry.targetOwner.email }}</template></p><p v-if="entry.reason">{{ entry.reason }}</p></div><time :datetime="entry.createdAt">{{ formatAdminTimestamp(entry.createdAt) }} · Mendoza</time></li></ol></section>
      </article>
    </div>
  </section>
</template>
