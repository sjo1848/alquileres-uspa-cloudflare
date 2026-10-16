<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ApiError, apiUrl } from '../api';
import { useSession } from '../session';
import { currencyOptions, pricePeriodOptions, rentalDurationOptions, formatRentalPrice, type Currency, type PricePeriod, type RentalDuration } from './rental-domain';
type Fields = { title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number };
type Listing = Fields & { id:string; status:'DRAFT'|'REJECTED'|'SUBMITTED'|'APPROVED'; rejectionReason:string|null; publicationStatus:string };
type Image = { id:string; originalName:string; contentType:string; sizeBytes:number; position:number; createdAt:string };
const MAX_IMAGE_BYTES=1_800_000, MAX_IMAGES=20;
const session=useSession(), listings=ref<Listing[]>([]), selectedId=ref<string|null>(null);
const busy=ref(false), loading=ref(true), error=ref(''), notice=ref('');
const images=ref<Image[]>([]),imagesLoading=ref(false),imageBusy=ref<'upload'|'delete'|'reorder'|null>(null);
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
let pendingUpload:{identity:string;key:string}|undefined;
const imageKeys=new Map<string,string>();let imageLoadVersion=0;
function imageMutationKey(operation:string){let key=imageKeys.get(operation);if(!key){key=crypto.randomUUID();imageKeys.set(operation,key);}return key;}
const label=(status:string)=>({DRAFT:'Borrador',REJECTED:'Rechazada',SUBMITTED:'En revisión',APPROVED:'Aprobada'}[status]??status);
function message(e:unknown){
  if(e instanceof ApiError&&e.status===400)return 'Completá los campos obligatorios de la publicación y guardá los cambios antes de enviarla.';
  if(e instanceof ApiError&&e.status===413)return 'La imagen supera el límite de 1,8 MB.';
  if(e instanceof ApiError&&e.status===507)return 'Se alcanzó el espacio reservado para imágenes en este Preview.';
  if(e instanceof ApiError&&e.status===409)return 'La publicación cambió. Recargá tus publicaciones antes de reintentar.';
  if(e instanceof ApiError&&e.status===404)return 'La publicación ya no está disponible para editar.';
  return 'No pudimos confirmar la operación. Reintentá con los mismos datos.';
}
function imageMessage(e:unknown){
  if(e instanceof ApiError&&e.status===400)return 'El archivo debe ser una imagen JPEG, PNG o WebP válida.';
  if(e instanceof ApiError&&e.status===409)return 'La publicación está ocupada o alcanzó el máximo de 20 imágenes.';
  if(e instanceof ApiError&&e.status===413)return 'La imagen supera el límite de 1,8 MB.';
  if(e instanceof ApiError&&e.status===507)return 'Se alcanzó el espacio reservado para imágenes en este Preview.';
  return message(e);
}
function choose(item?:Listing){
  if(busy.value)return;
  selectedId.value=item?.id??null;
  Object.assign(form,item?Object.fromEntries(Object.keys(blank()).map(key=>[key,item[key as keyof Fields]])):blank());
  error.value='';notice.value='';pendingCreate=undefined;
  confirmReload.value=false;
  pendingSelection.value=null;
  images.value=[];imageLoadVersion++;
  if(item&&['DRAFT','REJECTED'].includes(item.status))void loadImages(item);
}
async function loadImages(item:Listing){
  const version=++imageLoadVersion;imagesLoading.value=true;
  try{const result=await session.apiRequest<Image[]>(`/listings/${encodeURIComponent(item.id)}/images`);if(version===imageLoadVersion&&selectedId.value===item.id)images.value=result;}
  catch(e){if(version===imageLoadVersion&&selectedId.value===item.id)error.value=message(e);}
  finally{if(version===imageLoadVersion)imagesLoading.value=false;}
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
async function upload(event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0],item=selected.value;
  if(!file||!item||!canEdit.value||busy.value)return;
  if(file.size<16||file.size>MAX_IMAGE_BYTES){error.value='La imagen debe pesar entre 16 bytes y 1,8 MB.';input.value='';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){error.value='Usá una imagen JPEG, PNG o WebP.';input.value='';return;}
  if(images.value.length>=MAX_IMAGES){error.value='Esta publicación ya tiene 20 imágenes.';input.value='';return;}
  busy.value=true;imageBusy.value='upload';error.value='';notice.value='';
  try{
    const bytes=await file.arrayBuffer(),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const signature=[...digest].map(value=>value.toString(16).padStart(2,'0')).join('');
    const identity=`${item.id}|${file.name}|${file.size}|${file.lastModified}|${signature}`;
    if(pendingUpload?.identity!==identity)pendingUpload={identity,key:crypto.randomUUID()};
    await session.apiRequest<Image>(`/listings/${encodeURIComponent(item.id)}/images`,{method:'POST',body:file,headers:{'Content-Type':file.type,'X-Image-Name':encodeURIComponent(file.name),'Idempotency-Key':pendingUpload.key}});
    if(selectedId.value===item.id){await loadImages(item);notice.value='Imagen guardada en tu publicación.';}
    pendingUpload=undefined;
  }catch(e){error.value=imageMessage(e);}
  finally{busy.value=false;imageBusy.value=null;input.value='';}
}
async function removeImage(image:Image){
  const item=selected.value;if(!item||busy.value||!canEdit.value)return;
  busy.value=true;imageBusy.value='delete';error.value='';notice.value='';
  const keyScope=`delete:${item.id}:${image.id}`,key=imageMutationKey(keyScope);
  try{await session.apiRequest(`/listings/${encodeURIComponent(item.id)}/images/${encodeURIComponent(image.id)}`,{method:'DELETE',headers:{'Idempotency-Key':key}});imageKeys.delete(keyScope);await loadImages(item);notice.value='Imagen eliminada.';}
  catch(e){error.value=imageMessage(e);}
  finally{busy.value=false;imageBusy.value=null;}
}
async function moveImage(image:Image,delta:number){
  const item=selected.value;if(!item||busy.value||!canEdit.value)return;
  const position=image.position+delta;if(position<0||position>=images.value.length)return;
  const keyScope=`reorder:${item.id}:${image.id}:${position}`,key=imageMutationKey(keyScope);
  busy.value=true;imageBusy.value='reorder';error.value='';notice.value='';
  try{images.value=await session.apiRequest<Image[]>(`/listings/${encodeURIComponent(item.id)}/images/${encodeURIComponent(image.id)}`,{method:'PATCH',body:JSON.stringify({position}),headers:{'Idempotency-Key':key}});imageKeys.delete(keyScope);notice.value='Orden de imágenes actualizado.';}
  catch(e){error.value=imageMessage(e);}
  finally{busy.value=false;imageBusy.value=null;}
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
          <section class="subsection" aria-labelledby="owner-images-title">
            <h3 id="owner-images-title">Imágenes</h3>
            <p class="notice">JPEG, PNG o WebP; hasta 1,8 MB por imagen y 20 por publicación.</p>
            <label v-if="canEdit&&images.length<MAX_IMAGES">Agregar foto
              <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy||loading" @change="upload" />
            </label>
            <p v-if="imagesLoading" role="status">Cargando imágenes…</p>
            <p v-else-if="!images.length">Todavía no hay imágenes.</p>
            <ul v-else class="image-list" :aria-busy="imageBusy!==null">
              <li v-for="image in images" :key="image.id">
                <img :src="apiUrl(`/listings/${encodeURIComponent(selected.id)}/images/${encodeURIComponent(image.id)}`)" :alt="`Imagen ${image.position+1} de ${selected.title}`" width="96" height="72" loading="lazy" />
                <span>{{ image.position+1 }}. {{ image.originalName }}</span>
                <button type="button" :disabled="busy||image.position===0" :aria-label="`Mover ${image.originalName} hacia arriba`" @click="moveImage(image,-1)">↑</button>
                <button type="button" :disabled="busy||image.position===images.length-1" :aria-label="`Mover ${image.originalName} hacia abajo`" @click="moveImage(image,1)">↓</button>
                <button type="button" :disabled="busy" :aria-label="`Eliminar ${image.originalName}`" @click="removeImage(image)">Eliminar</button>
              </li>
            </ul>
          </section>
          <p v-if="canEdit&&dirty" class="notice">Guardá los cambios antes de enviar a revisión.</p>
          <button v-if="canEdit" :disabled="busy||dirty||imagesLoading" @click="submit">Enviar a revisión</button>
          <p v-else-if="selected.status==='SUBMITTED'">Tu publicación está en revisión.</p>
          <RouterLink v-if="selected.status==='APPROVED'&&selected.publicationStatus==='PUBLISHED'" :to="`/listings/${selected.id}`">Ver ficha publicada</RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>
