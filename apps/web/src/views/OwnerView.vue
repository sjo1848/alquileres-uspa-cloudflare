<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ApiError, apiUrl } from '../api';
import { useSession } from '../session';
import { currencyOptions, pricePeriodOptions, rentalDurationOptions, formatRentalPrice, type Currency, type PricePeriod, type RentalDuration } from './rental-domain';
import { formatImageSize } from './image-size';
type DepositStatus='NOT_INFORMED'|'ASK_OWNER'|'NOT_REQUIRED'|'FIXED_AMOUNT';
type ServiceInclusion='INCLUDED'|'NOT_INCLUDED'|'NOT_INFORMED';
type PetsPolicy='ALLOWED'|'NOT_ALLOWED'|'ASK_OWNER'|'NOT_INFORMED';
type Fields = { title:string; description:string; location:string; priceAmount:number; currency:Currency; pricePeriod:PricePeriod; rentalDuration:RentalDuration; maxOccupants:number; depositStatus:DepositStatus; depositAmount:number|null; depositCurrency:Currency|null; internetIncluded:ServiceInclusion; waterIncluded:ServiceInclusion; electricityIncluded:ServiceInclusion; gasIncluded:ServiceInclusion; petsPolicy:PetsPolicy; availableFrom:string|null };
type Listing = Omit<Fields,'depositStatus'|'depositAmount'|'depositCurrency'|'internetIncluded'|'waterIncluded'|'electricityIncluded'|'gasIncluded'|'petsPolicy'|'availableFrom'> & { depositStatus:DepositStatus|null; depositAmount:number|null; depositCurrency:Currency|null; internetIncluded:ServiceInclusion|null; waterIncluded:ServiceInclusion|null; electricityIncluded:ServiceInclusion|null; gasIncluded:ServiceInclusion|null; petsPolicy:PetsPolicy|null; availableFrom:string|null; id:string; status:'DRAFT'|'REJECTED'|'SUBMITTED'|'APPROVED'; rejectionReason:string|null; publicationStatus:string; availabilityStatus:'AVAILABLE'|'UNAVAILABLE'; lastConfirmedAt:string|null };
type Image = { id:string; originalName:string; contentType:string; sizeBytes:number; position:number; createdAt?:string; source?:'STATIC_ASSET'|'OWNER_UPLOAD' };
type ContactEvent = { id:string; state:'UNREAD'|'READ'; visitorName:string; visitorEmail:string; message:string; createdAt:string; listing:{id:string;title:string;location:string} };
type OwnerSection = 'information'|'photographs'|'availability';
const MAX_IMAGE_BYTES=1_800_000, MAX_IMAGES=20;
const MAX_IMAGE_WIDTH=640,MAX_IMAGE_HEIGHT=480;
const session=useSession(), listings=ref<Listing[]>([]), selectedId=ref<string|null>(null);
const creating=ref(false);
const busy=ref(false), loading=ref(true), error=ref(''), notice=ref('');
const images=ref<Image[]>([]),imagesLoading=ref(false),imagesLoadError=ref(''),imageBusy=ref<'upload'|'delete'|'reorder'|null>(null);
const contacts=ref<ContactEvent[]>([]), unreadContacts=ref(0), contactsLoading=ref(false), contactBusy=ref('');
const mediaConfigLoading=ref(false),mediaConfigError=ref('');
const confirmReload=ref(false);
const pendingSelection=ref<{item?:Listing}|null>(null);
const confirmDelete=ref(false), confirmLeave=ref(false), pendingImageDelete=ref<Image|null>(null);
const leaveDialog=ref<HTMLElement|null>(null),imageDeleteDialog=ref<HTMLElement|null>(null),listingDeleteDialog=ref<HTMLElement|null>(null),selectionDialog=ref<HTMLElement|null>(null),reloadDialog=ref<HTMLElement|null>(null);
const selectedPhoto=ref<{file:File;previewUrl:string}|null>(null);
const statusFilter=ref<'ALL'|'DRAFT'|'REJECTED'|'SUBMITTED'|'APPROVED'>('ALL');
const activeOwnerSection=ref<OwnerSection>('information');
const mobilePane=ref<'inventory'|'detail'>('inventory');
const blank=():Fields=>({title:'',description:'',location:'Uspallata',priceAmount:0,currency:'ARS',pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:1,depositStatus:'NOT_INFORMED',depositAmount:null,depositCurrency:null,internetIncluded:'NOT_INFORMED',waterIncluded:'NOT_INFORMED',electricityIncluded:'NOT_INFORMED',gasIncluded:'NOT_INFORMED',petsPolicy:'NOT_INFORMED',availableFrom:null});
const normalizeListing=(item:Listing):Listing=>({...item,depositStatus:item.depositStatus??'NOT_INFORMED',depositAmount:item.depositAmount??null,depositCurrency:item.depositCurrency??null,internetIncluded:item.internetIncluded??'NOT_INFORMED',waterIncluded:item.waterIncluded??'NOT_INFORMED',electricityIncluded:item.electricityIncluded??'NOT_INFORMED',gasIncluded:item.gasIncluded??'NOT_INFORMED',petsPolicy:item.petsPolicy??'NOT_INFORMED',availableFrom:item.availableFrom??null});
const form=reactive<Fields>(blank());
const listingsLoadError=ref('');
const selected=computed(()=>listings.value.find(x=>x.id===selectedId.value));
const visibleListings=computed(()=>statusFilter.value==='ALL'?listings.value:listings.value.filter(item=>item.status===statusFilter.value));
const listingCounts=computed(()=>({all:listings.value.length,drafts:listings.value.filter(item=>item.status==='DRAFT'||item.status==='REJECTED').length,review:listings.value.filter(item=>item.status==='SUBMITTED').length,published:listings.value.filter(item=>item.status==='APPROVED'&&item.publicationStatus==='PUBLISHED').length}));
const nextStep=computed(()=>{if(!selected.value)return 'Elegí una publicación o empezá un nuevo borrador.';if(selected.value.status==='REJECTED')return 'Revisá el motivo, corregí los datos y volvé a enviarla.';if(selected.value.status==='DRAFT')return dirty.value?'Guardá tus cambios para continuar.':'Completá la publicación y enviála a revisión cuando esté lista.';if(selected.value.status==='SUBMITTED')return 'El equipo está revisando esta publicación. Te avisaremos cuando cambie.';if(selected.value.publicationStatus==='PUBLISHED')return 'Tu alojamiento está publicado. Revisá la disponibilidad cuando cambie.';return 'La publicación fue aprobada y está pendiente de publicación.';});
const confirmedLabel=computed(()=>selected.value?.lastConfirmedAt?new Date(selected.value.lastConfirmedAt).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Mendoza'}):'Todavía no confirmaste la disponibilidad.');
const canEdit=computed(()=>!selected.value||['DRAFT','REJECTED'].includes(selected.value.status));
const ownerUploadsEnabled=computed(()=>session.mediaStrategy.value==='D1_BLOB');
const hasRepositoryManagedImages=computed(()=>images.value.some(image=>image.source==='STATIC_ASSET'));
const ownerCanUpload=computed(()=>ownerUploadsEnabled.value&&!imagesLoading.value&&!imagesLoadError.value&&!hasRepositoryManagedImages.value);
const mutableImages=computed(()=>images.value.filter(image=>image.source!=='STATIC_ASSET'));
const dirty=computed(()=>selected.value&&Object.keys(blank()).some(key=>form[key as keyof Fields]!==selected.value![key as keyof Fields]));
const unsaved=computed(()=>{
  const baseline=selected.value??blank();
  return selectedPhoto.value!==null||Object.keys(blank()).some(key=>form[key as keyof Fields]!==baseline[key as keyof Fields]);
});
let pendingCreate:{body:string;key:string}|undefined;
let pendingListingDelete:{id:string;key:string}|undefined;
let pendingUpload:{identity:string;key:string}|undefined;
const imageKeys=new Map<string,string>();let imageLoadVersion=0;
let resolveLeave:((leave:boolean)=>void)|null=null;
type DialogName='leave'|'image-delete'|'listing-delete'|'selection'|'reload';
const dialogReturnFocus:Partial<Record<DialogName,HTMLElement|null>>={};
function openDialog(name:DialogName,dialog:typeof leaveDialog,trigger?:HTMLElement|null){
  dialogReturnFocus[name]=trigger??(document.activeElement instanceof HTMLElement?document.activeElement:null);
  void nextTick(()=>dialog.value?.querySelector<HTMLButtonElement>('[data-dialog-initial-focus]')?.focus());
}
function closeDialogFocus(name:DialogName,fallbackId?:string,fallbackFirst=false){
  const trigger=dialogReturnFocus[name];delete dialogReturnFocus[name];
  void nextTick(()=>{const fallback=fallbackId?document.getElementById(fallbackId):null;if(fallbackFirst&&fallback){fallback.focus({preventScroll:true});return;}if(trigger?.isConnected){trigger.focus({preventScroll:true});return;}fallback?.focus({preventScroll:true});});
}
function trapDialogFocus(event:KeyboardEvent,dialog:HTMLElement|null,onEscape:()=>void){
  if(event.key==='Escape'){event.preventDefault();onEscape();return;}
  if(event.key!=='Tab')return;
  if(!dialog)return;
  const controls=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  if(!controls.length){event.preventDefault();return;}
  const first=controls[0],last=controls[controls.length-1],active=document.activeElement;
  if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
}
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
  if(e instanceof ApiError&&e.code==='LEGACY_MEDIA_MIGRATION_REQUIRED')return 'Esta publicación conserva fotos de una carga anterior y necesita migración antes de editar o mostrar sus imágenes.';
  if(e instanceof ApiError&&e.status===409)return 'La publicación está ocupada o alcanzó el máximo de 20 imágenes.';
  if(e instanceof ApiError&&e.status===413)return 'La imagen supera el límite de 1,8 MB.';
  if(e instanceof ApiError&&e.status===507)return 'Se alcanzó el espacio reservado para imágenes en este Preview.';
  return message(e);
}
async function loadMediaConfig(){
  if(mediaConfigLoading.value)return;
  mediaConfigLoading.value=true;mediaConfigError.value='';
  try{await session.loadAuthStrategy();if(session.mediaStrategy.value==='UNKNOWN')throw new Error('Image storage configuration is unavailable');}
  catch{mediaConfigError.value='No pudimos comprobar cómo se gestionan las fotos. Reintentá para habilitar las acciones disponibles.';}
  finally{mediaConfigLoading.value=false;}
}
async function normalizePhoto(file:File){
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,MAX_IMAGE_WIDTH/bitmap.width,MAX_IMAGE_HEIGHT/bitmap.height);
    const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)throw new Error('image canvas unavailable');
    context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
    const image=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('image conversion failed')),'image/jpeg',0.82));
    return {image,name:`${file.name.replace(/\.[^.]+$/u,'')||'foto'}.jpg`};
  }finally{bitmap.close();}
}
function choose(item?:Listing){
  if(busy.value)return;
  discardSelectedPhoto();pendingImageDelete.value=null;
  creating.value=!item;
  activeOwnerSection.value='information';mobilePane.value='detail';
  const normalized=item?normalizeListing(item):undefined;
  selectedId.value=normalized?.id??null;
  Object.assign(form,normalized?Object.fromEntries(Object.keys(blank()).map(key=>[key,normalized[key as keyof Fields]])):blank());
  error.value='';notice.value='';pendingCreate=undefined;
  confirmReload.value=false;
  pendingSelection.value=null;
  confirmDelete.value=false;
  images.value=[];imagesLoading.value=false;imagesLoadError.value='';imageLoadVersion++;
  if(item)void loadImages(item);
}
function changeDepositStatus(value:DepositStatus){form.depositStatus=value;if(value!=='FIXED_AMOUNT'){form.depositAmount=null;form.depositCurrency=null;}}
function returnToInventory(){mobilePane.value='inventory';void nextTick(()=>document.getElementById('owner-listings-title')?.focus({preventScroll:true}));}
function resumeEditing(){
  if(!unsaved.value)return;
  mobilePane.value='detail';
  if(selectedPhoto.value)activeOwnerSection.value='photographs';
  void nextTick(()=>document.querySelector<HTMLElement>('.owner-editor [role="tabpanel"]')?.focus({preventScroll:true}));
}
const ownerSections:OwnerSection[]=['information','photographs','availability'];
function selectOwnerSection(section:OwnerSection){if(section!=='information'&&!selected.value)return;activeOwnerSection.value=section;}
function onOwnerSectionKeydown(event:KeyboardEvent,current:OwnerSection){
  const target=event.key==='ArrowRight'?ownerSections[(ownerSections.indexOf(current)+1)%ownerSections.length]:event.key==='ArrowLeft'?ownerSections[(ownerSections.indexOf(current)+ownerSections.length-1)%ownerSections.length]:event.key==='Home'?ownerSections[0]:event.key==='End'?ownerSections[ownerSections.length-1]:undefined;
  if(!target||((target==='photographs'||target==='availability')&&!selected.value))return;
  event.preventDefault();selectOwnerSection(target);void nextTick(()=>document.querySelector<HTMLButtonElement>(`[data-owner-section="${target}"]`)?.focus());
}
async function loadImages(item:Listing){
  const version=++imageLoadVersion,previousError=imagesLoadError.value;imagesLoading.value=true;imagesLoadError.value='';if(previousError&&error.value===previousError)error.value='';
  try{const result=await session.apiRequest<Image[]>(`/listings/${encodeURIComponent(item.id)}/images`);if(version===imageLoadVersion&&selectedId.value===item.id)images.value=result;}
  catch(e){if(version===imageLoadVersion&&selectedId.value===item.id){imagesLoadError.value='No pudimos confirmar si esta publicación tiene fotos administradas desde el repositorio. Reintentá antes de agregar una foto.';error.value=imagesLoadError.value;}}
  finally{if(version===imageLoadVersion)imagesLoading.value=false;}
}
async function retryLoadImages(){const item=selected.value;if(item&&!imagesLoading.value)await loadImages(item);}
function requestChoose(item?:Listing,event?:MouseEvent){
  if(busy.value)return;
  if(unsaved.value){pendingSelection.value={item};confirmReload.value=false;openDialog('selection',selectionDialog,event?.currentTarget instanceof HTMLElement?event.currentTarget:null);return;}
  choose(item);
}
function cancelChoose(){pendingSelection.value=null;closeDialogFocus('selection');}
function confirmChoose(){if(!pendingSelection.value)return;const item=pendingSelection.value.item;pendingSelection.value=null;choose(item);closeDialogFocus('selection');}
async function load(discardChanges=false,trigger?:HTMLElement|null){
  if(busy.value)return;
  pendingSelection.value=null;
  if(unsaved.value&&discardChanges!==true){confirmReload.value=true;openDialog('reload',reloadDialog,trigger);return;}
  confirmReload.value=false;listingsLoadError.value='';
  loading.value=true;error.value='';
  try{
    const selected=selectedId.value;
    listings.value=(await session.apiRequest<Listing[]>('/listings')).map(normalizeListing);
    if(selected){
      const refreshed=listings.value.find(item=>item.id===selected);
      choose(refreshed);
      if(!refreshed)notice.value='La publicación seleccionada ya no está disponible.';
    }
  }
  catch{listingsLoadError.value='No pudimos cargar tus alojamientos.';}
  finally{loading.value=false;}
}
function requestReload(event:MouseEvent){void load(false,event.currentTarget instanceof HTMLElement?event.currentTarget:null);}
function cancelReload(){confirmReload.value=false;closeDialogFocus('reload');}
async function discardAndReload(){confirmReload.value=false;closeDialogFocus('reload');await load(true);}
async function refreshSelected(){
  const item=selected.value;if(!item||busy.value||unsaved.value)return;
  busy.value=true;error.value='';notice.value='';
  try{const current=await session.apiRequest<Listing>(`/listings/${encodeURIComponent(item.id)}`);remember(current);await loadImages(current);notice.value='Publicación actualizada.';}
  catch(e){error.value=message(e);}
  finally{busy.value=false;}
}
async function removeListing(event?:MouseEvent){
  const item=selected.value;if(!item||busy.value||!canEdit.value)return;
  confirmDelete.value=true;
  openDialog('listing-delete',listingDeleteDialog,event?.currentTarget instanceof HTMLElement?event.currentTarget:null);
}
async function confirmRemoveListing(){
  const item=selected.value;if(!item||busy.value||!canEdit.value)return;
  confirmDelete.value=false;
  if(pendingListingDelete?.id!==item.id)pendingListingDelete={id:item.id,key:crypto.randomUUID()};
  busy.value=true;error.value='';notice.value='';
  try{
    await session.apiRequest<{id:string;deleted:true}>(`/listings/${encodeURIComponent(item.id)}`,{method:'DELETE',headers:{'Idempotency-Key':pendingListingDelete.key}});
    discardSelectedPhoto();listings.value=listings.value.filter(row=>row.id!==item.id);selectedId.value=null;creating.value=false;activeOwnerSection.value='information';mobilePane.value='inventory';Object.assign(form,blank());images.value=[];pendingListingDelete=undefined;notice.value='Publicación eliminada.';closeDialogFocus('listing-delete','owner-listings-title',true);
  }catch(e){error.value=message(e);closeDialogFocus('listing-delete');}
  finally{busy.value=false;}
}
function remember(item:Listing){
  item=normalizeListing(item);
  const index=listings.value.findIndex(x=>x.id===item.id);
  if(index<0)listings.value.unshift(item);else listings.value[index]=item;
  selectedId.value=item.id;creating.value=false;Object.assign(form,Object.fromEntries(Object.keys(blank()).map(key=>[key,item[key as keyof Fields]])));
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
  const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;
  if(file.size<16||file.size>MAX_IMAGE_BYTES){error.value='La imagen debe pesar entre 16 bytes y 1,8 MB.';input.value='';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){error.value='Usá una imagen JPEG, PNG o WebP.';input.value='';return;}
  if(images.value.length>=MAX_IMAGES){error.value='Esta publicación ya tiene 20 imágenes.';input.value='';return;}
  discardSelectedPhoto();error.value='';selectedPhoto.value={file,previewUrl:URL.createObjectURL(file)};
}
function discardSelectedPhoto(){if(selectedPhoto.value)URL.revokeObjectURL(selectedPhoto.value.previewUrl);selectedPhoto.value=null;}
async function uploadSelectedPhoto(){
  const file=selectedPhoto.value?.file,item=selected.value;if(!file||!item||!canEdit.value||busy.value)return;
  busy.value=true;imageBusy.value='upload';error.value='';notice.value='';
  try{
    const {image,name}=await normalizePhoto(file),bytes=await image.arrayBuffer(),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    const signature=[...digest].map(value=>value.toString(16).padStart(2,'0')).join('');
    const identity=`${item.id}|${name}|${file.size}|${file.lastModified}|${signature}`;
    if(pendingUpload?.identity!==identity)pendingUpload={identity,key:crypto.randomUUID()};
    await session.apiRequest<Image>(`/listings/${encodeURIComponent(item.id)}/images`,{method:'POST',body:image,headers:{'Content-Type':image.type,'X-Image-Name':encodeURIComponent(name),'Idempotency-Key':pendingUpload.key}});
    if(selectedId.value===item.id){await loadImages(item);notice.value='Imagen guardada en tu publicación.';}
    pendingUpload=undefined;discardSelectedPhoto();
  }catch(e){error.value=imageMessage(e);}
  finally{busy.value=false;imageBusy.value=null;}
}
function requestRemoveImage(image:Image,event?:MouseEvent){if(!busy.value&&canEdit.value){pendingImageDelete.value=image;openDialog('image-delete',imageDeleteDialog,event?.currentTarget instanceof HTMLElement?event.currentTarget:null);}}
function closeImageDelete(){pendingImageDelete.value=null;closeDialogFocus('image-delete');}
function closeListingDelete(){confirmDelete.value=false;closeDialogFocus('listing-delete');}
async function removeImage(){
  const image=pendingImageDelete.value;
  const item=selected.value;if(!item||!image||busy.value||!canEdit.value)return;
  busy.value=true;imageBusy.value='delete';error.value='';notice.value='';
  const keyScope=`delete:${item.id}:${image.id}`,key=imageMutationKey(keyScope);
  try{await session.apiRequest(`/listings/${encodeURIComponent(item.id)}/images/${encodeURIComponent(image.id)}`,{method:'DELETE',headers:{'Idempotency-Key':key}});imageKeys.delete(keyScope);pendingImageDelete.value=null;closeDialogFocus('image-delete','owner-images-title',true);await loadImages(item);notice.value='Imagen eliminada.';}
  catch(e){error.value=imageMessage(e);}
  finally{busy.value=false;imageBusy.value=null;}
}
async function moveImage(image:Image,delta:number){
  const item=selected.value;if(!item||busy.value||!canEdit.value)return;
  const position=image.position+delta;if(position<0||position>=mutableImages.value.length)return;
  const keyScope=`reorder:${item.id}:${image.id}:${position}`,key=imageMutationKey(keyScope);
  busy.value=true;imageBusy.value='reorder';error.value='';notice.value='';
  try{await session.apiRequest<Image[]>(`/listings/${encodeURIComponent(item.id)}/images/${encodeURIComponent(image.id)}`,{method:'PATCH',body:JSON.stringify({position}),headers:{'Idempotency-Key':key}});imageKeys.delete(keyScope);await loadImages(item);notice.value='Orden de imágenes actualizado.';}
  catch(e){error.value=imageMessage(e);}
  finally{busy.value=false;imageBusy.value=null;}
}
type ContactCursor={createdAt:string;id:string};const nextContactCursor=ref<ContactCursor|null>(null),contactsLoadError=ref('');
async function fetchContactPage(cursor:ContactCursor|null){const params=new URLSearchParams();if(cursor){params.set('afterCreatedAt',cursor.createdAt);params.set('afterId',cursor.id);}return session.apiRequest<{items:ContactEvent[];unreadCount:number;nextCursor:ContactCursor|null}>(`/owner/contact-events${params.size?`?${params}`:''}`);}
async function loadContacts(cursor:ContactCursor|null=null,append=false){contactsLoading.value=true;contactsLoadError.value='';try{const result=await fetchContactPage(cursor);contacts.value=append?[...contacts.value,...result.items]:result.items;unreadContacts.value=result.unreadCount;nextContactCursor.value=result.nextCursor;}catch{contactsLoadError.value='No pudimos cargar tus consultas.';}finally{contactsLoading.value=false;}}
async function setContactState(event:ContactEvent,state:'UNREAD'|'READ'){if(contactBusy.value)return;contactBusy.value=event.id;error.value='';try{await session.apiRequest(`/owner/contact-events/${encodeURIComponent(event.id)}/state`,{method:'PATCH',body:JSON.stringify({state})});const loaded=contacts.value.find(item=>item.id===event.id);if(loaded&&loaded.state!==state){unreadContacts.value=Math.max(0,unreadContacts.value+(state==='UNREAD'?1:-1));loaded.state=state;}notice.value=state==='READ'?'Consulta marcada como leída.':'Consulta marcada como no leída.';try{unreadContacts.value=(await fetchContactPage(null)).unreadCount;}catch{/* Keep the confirmed local update if refreshing the aggregate count fails. */}}catch{error.value='No pudimos actualizar el estado de la consulta.';}finally{contactBusy.value='';}}
async function loadMoreContacts(){if(nextContactCursor.value)await loadContacts(nextContactCursor.value,true);}
async function updateAvailability(status:'AVAILABLE'|'UNAVAILABLE'){const item=selected.value;if(!item||contactBusy.value)return;contactBusy.value='availability';error.value='';try{const updated=await session.apiRequest<Listing&{availabilityStatus:string;lastConfirmedAt:string|null}>(`/listings/${encodeURIComponent(item.id)}/availability`,{method:'PATCH',body:JSON.stringify({availabilityStatus:status})});Object.assign(item,updated);notice.value='Disponibilidad actualizada.';}catch{error.value='No pudimos actualizar la disponibilidad.';}finally{contactBusy.value='';}}
async function reconfirmAvailability(){const item=selected.value;if(!item||contactBusy.value)return;contactBusy.value='availability';error.value='';try{const updated=await session.apiRequest<Listing&{availabilityStatus:string;lastConfirmedAt:string|null}>(`/listings/${encodeURIComponent(item.id)}/reconfirm`,{method:'POST'});Object.assign(item,updated);notice.value='Disponibilidad confirmada.';}catch{error.value='No pudimos confirmar la disponibilidad.';}finally{contactBusy.value='';}}
function resolvePendingLeave(leave:boolean){const resolve=resolveLeave;resolveLeave=null;confirmLeave.value=false;resolve?.(leave);if(!leave)closeDialogFocus('leave');else delete dialogReturnFocus.leave;}
onBeforeRouteLeave(()=>{
  if(!session.isAuthenticated.value)return true;
  if(!unsaved.value)return true;
  confirmLeave.value=true;
  openDialog('leave',leaveDialog);
  return new Promise<boolean>(resolve=>{resolveLeave=resolve;});
});
function beforeUnload(event:BeforeUnloadEvent){if(unsaved.value){event.preventDefault();event.returnValue='';}}
onMounted(()=>{void load();void loadContacts();if(session.mediaStrategy.value==='UNKNOWN')void loadMediaConfig();window.addEventListener('beforeunload',beforeUnload);});
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',beforeUnload);resolvePendingLeave(false);discardSelectedPhoto();});
</script>
<template>
  <section class="owner-dashboard" :class="{ 'showing-detail-mobile': mobilePane==='detail' }">
    <header class="owner-workspace-header">
      <div class="owner-workspace-title">
        <p class="eyebrow">PANEL DEL PROPIETARIO</p>
        <h1>Mis alojamientos</h1>
        <p>Gestioná tus publicaciones y mantené la disponibilidad al día.</p>
      </div>
      <div class="owner-header-actions">
        <span v-if="session.user.value?.email" class="owner-account">{{ session.user.value.email }}</span>
        <button type="button" :disabled="busy||loading||!!listingsLoadError" @click="requestChoose(undefined,$event)">+ Nuevo alojamiento</button>
      </div>
    </header>

    <nav class="owner-section-nav" aria-label="Secciones del panel OWNER">
      <a href="#owner-listings"><span aria-hidden="true">⌂</span>Alojamientos <span>{{ listingCounts.all }}</span></a>
      <a href="#owner-inbox"><span aria-hidden="true">✉</span>Consultas <span>{{ unreadContacts ? `${unreadContacts} sin leer` : 'Bandeja' }}</span></a>
    </nav>

    <div class="owner-metrics" aria-label="Resumen de publicaciones">
      <article><span>Total</span><strong>{{ listingCounts.all }}</strong><small>alojamientos</small></article>
      <article class="needs-action"><span>Próxima acción</span><strong>{{ listingCounts.drafts }}</strong><small>borradores o correcciones</small></article>
      <article><span>En revisión</span><strong>{{ listingCounts.review }}</strong><small>esperando al equipo</small></article>
      <article><span>Publicados</span><strong>{{ listingCounts.published }}</strong><small>visibles en el catálogo</small></article>
    </div>

    <p v-if="error" class="error owner-feedback" role="alert">{{ error }}</p>
    <p v-if="notice" class="success owner-feedback" role="status">{{ notice }}</p>

    <section id="owner-listings" class="owner-workspace" aria-labelledby="owner-listings-title">
      <aside class="owner-list-panel card">
        <div class="owner-list-heading">
          <div><p class="eyebrow">INVENTARIO</p><h2 id="owner-listings-title" tabindex="-1">Tus publicaciones <span>{{ visibleListings.length }}</span></h2></div>
        </div>
        <label class="owner-filter-label" for="owner-status-filter">Mostrar</label>
        <select id="owner-status-filter" v-model="statusFilter">
          <option value="ALL">Todos ({{ listingCounts.all }})</option>
          <option value="DRAFT">Borradores</option>
          <option value="REJECTED">Requieren cambios</option>
          <option value="SUBMITTED">En revisión</option>
          <option value="APPROVED">Aprobados</option>
        </select>
        <p v-if="loading" class="owner-empty" role="status">Cargando tus alojamientos…</p>
        <p v-if="!loading&&listingsLoadError" class="error owner-load-error" role="alert">{{ listingsLoadError }} <button type="button" class="secondary" :disabled="loading" @click="load()">Reintentar carga de alojamientos</button></p>
        <div v-if="!loading&&!listingsLoadError&&!listings.length" class="owner-empty">
          <span class="owner-empty-mark" aria-hidden="true">⌂</span>
          <h3>Empezá por tu primer alojamiento</h3>
          <p>Guardá un borrador y agregá fotos cuando estés listo. Nada se publica sin revisión.</p>
          <button type="button" class="secondary" @click="requestChoose(undefined,$event)">Crear mi primer borrador</button>
        </div>
        <p v-if="!loading&&!listingsLoadError&&listings.length&&!visibleListings.length" class="owner-empty">No hay alojamientos en este estado.</p>
        <div v-if="!loading&&visibleListings.length" class="owner-listings" role="list" aria-label="Alojamientos del propietario">
          <button v-for="item in visibleListings" :key="item.id" type="button" class="owner-listing-row" :class="{selected:selectedId===item.id}" :aria-current="selectedId===item.id?'true':undefined" :disabled="busy" @click="requestChoose(item,$event)">
            <span class="owner-listing-top"><strong>{{ item.title }}</strong><span class="owner-status" :class="`is-${item.status.toLowerCase()}`">{{ label(item.status) }}</span></span>
            <span class="owner-listing-location">{{ item.location }}</span>
            <span class="owner-listing-price">{{ formatRentalPrice(item) }}</span>
            <span class="owner-listing-next">{{ item.status==='REJECTED'?'Corregir y reenviar':item.status==='DRAFT'?'Completar publicación':item.status==='SUBMITTED'?'En revisión':item.publicationStatus==='PUBLISHED'?'Visible en catálogo':'Aprobada · pendiente de publicar' }}</span>
          </button>
        </div>
        <div v-if="mobilePane==='inventory'&&unsaved" class="owner-resume-editing" role="status">
          <span>Tenés cambios sin guardar en {{ creating ? 'un nuevo borrador' : selected?.title || 'esta publicación' }}.</span>
          <button type="button" class="secondary" @click="resumeEditing">Continuar edición</button>
        </div>
        <button type="button" class="text-button owner-refresh" :disabled="busy||loading" @click="requestReload($event)">Actualizar lista</button>
      </aside>

      <article class="owner-editor card" :aria-busy="busy">
        <template v-if="selected || creating">
          <header class="owner-editor-heading">
            <button type="button" class="owner-mobile-back" @click="returnToInventory"><span aria-hidden="true">←</span> Mis alojamientos</button>
            <div class="owner-editor-title">
              <p class="eyebrow">{{ selected ? 'GESTIÓN DEL ALOJAMIENTO' : 'NUEVA PUBLICACIÓN' }}</p>
              <h2>{{ selected?.title || 'Contanos sobre tu lugar' }}</h2>
              <p v-if="selected" class="owner-editor-subtitle">{{ selected.location }} <span aria-hidden="true">·</span> {{ formatRentalPrice(selected) }}</p>
            </div>
            <span v-if="selected" class="owner-status owner-status-large" :class="`is-${selected.status.toLowerCase()}`">{{ label(selected.status) }}</span>
          </header>
          <section v-if="selected" class="owner-next-step" aria-labelledby="owner-next-step-title">
            <span class="owner-next-icon" aria-hidden="true">→</span>
            <div><h3 id="owner-next-step-title">Siguiente paso</h3><p>{{ nextStep }}</p></div>
          </section>
          <p v-if="selected?.rejectionReason" class="owner-rejection"><strong>Observación del equipo</strong><span>{{ selected.rejectionReason }}</span></p>
          <p v-if="selectedPhoto" class="owner-pending-photo" role="status">Hay una foto seleccionada que todavía no se guardó. <button type="button" class="text-button" @click="selectOwnerSection('photographs')">Ir a fotografías</button></p>

          <nav class="owner-editor-sections" role="tablist" aria-label="Secciones del alojamiento">
            <button id="owner-tab-information" data-owner-section="information" type="button" role="tab" :aria-selected="activeOwnerSection==='information'" aria-controls="owner-editor-panel" @click="selectOwnerSection('information')" @keydown="onOwnerSectionKeydown($event,'information')">Información</button>
            <button v-if="selected" id="owner-tab-photographs" data-owner-section="photographs" type="button" role="tab" :aria-selected="activeOwnerSection==='photographs'" aria-controls="owner-editor-panel" @click="selectOwnerSection('photographs')" @keydown="onOwnerSectionKeydown($event,'photographs')">Fotografías <span>{{ imagesLoadError?'—':images.length }}</span></button>
            <button v-if="selected" id="owner-tab-availability" data-owner-section="availability" type="button" role="tab" :aria-selected="activeOwnerSection==='availability'" aria-controls="owner-editor-panel" @click="selectOwnerSection('availability')" @keydown="onOwnerSectionKeydown($event,'availability')">Disponibilidad</button>
          </nav>

          <form v-if="activeOwnerSection==='information'" id="owner-editor-panel" class="owner-listing-form owner-tab-panel" role="tabpanel" aria-labelledby="owner-tab-information" tabindex="0" @submit.prevent="save" :aria-busy="busy">
            <fieldset :disabled="busy||!canEdit">
              <legend>El alojamiento</legend>
              <div class="owner-form-grid">
                <label class="owner-field-wide">Nombre del alojamiento<input v-model="form.title" name="title" required maxlength="120" autocomplete="off" placeholder="Ej. Casa de piedra junto al arroyo" /></label>
                <label class="owner-field-wide">Descripción<textarea v-model="form.description" name="description" maxlength="5000" rows="4" placeholder="¿Qué hace especial a este lugar?" /></label>
                <label class="owner-field-wide">Ubicación<input v-model="form.location" name="location" required maxlength="240" autocomplete="address-level2" /></label>
              </div>
            </fieldset>
            <fieldset :disabled="busy||!canEdit">
              <legend>Precio y huéspedes</legend>
              <div class="owner-form-grid owner-form-grid-compact">
                <label>Precio de referencia<input v-model.number="form.priceAmount" name="priceAmount" type="number" min="0" max="2147483647" step="1" required inputmode="numeric" /></label>
                <label>Moneda<select v-model="form.currency" name="currency"><option v-for="o in currencyOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
                <label>Periodicidad<select v-model="form.pricePeriod" name="pricePeriod"><option v-for="o in pricePeriodOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
                <label>Duración<select v-model="form.rentalDuration" name="rentalDuration"><option v-for="o in rentalDurationOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
                <label>Capacidad máxima<input v-model.number="form.maxOccupants" name="maxOccupants" type="number" min="1" max="2147483647" step="1" required inputmode="numeric" /></label>
              </div>
            </fieldset>
            <fieldset v-if="form.pricePeriod==='MONTH'" :disabled="busy||!canEdit">
              <legend>Condiciones del alquiler mensual</legend>
              <p class="owner-save-hint">Completá solo lo que conocés. Estos datos son declarados por vos; no se verifican ni generan una reserva.</p>
              <div class="owner-form-grid owner-form-grid-compact">
                <label>Depósito o garantía<select :value="form.depositStatus" name="depositStatus" @change="changeDepositStatus(($event.target as HTMLSelectElement).value as DepositStatus)"><option value="NOT_INFORMED">No informado</option><option value="ASK_OWNER">A consultar</option><option value="NOT_REQUIRED">No se requiere</option><option value="FIXED_AMOUNT">Monto fijo declarado</option></select></label>
                <template v-if="form.depositStatus==='FIXED_AMOUNT'">
                  <label>Monto fijo<input :value="form.depositAmount??''" name="depositAmount" type="number" min="1" max="2147483647" step="1" inputmode="numeric" required @input="form.depositAmount=($event.target as HTMLInputElement).value===''?null:Number(($event.target as HTMLInputElement).value)" /></label>
                  <label>Moneda del depósito<select v-model="form.depositCurrency" name="depositCurrency" required><option :value="null" disabled>Elegí una moneda</option><option value="ARS">Pesos argentinos (ARS)</option><option value="USD">Dólares estadounidenses (USD)</option></select></label>
                </template>
                <label>Internet incluido en el precio<select v-model="form.internetIncluded" name="internetIncluded"><option value="NOT_INFORMED">No informado</option><option value="INCLUDED">Incluido</option><option value="NOT_INCLUDED">No incluido</option></select></label>
                <label>Agua incluida en el precio<select v-model="form.waterIncluded" name="waterIncluded"><option value="NOT_INFORMED">No informado</option><option value="INCLUDED">Incluida</option><option value="NOT_INCLUDED">No incluida</option></select></label>
                <label>Electricidad incluida en el precio<select v-model="form.electricityIncluded" name="electricityIncluded"><option value="NOT_INFORMED">No informado</option><option value="INCLUDED">Incluida</option><option value="NOT_INCLUDED">No incluida</option></select></label>
                <label>Gas incluido en el precio<select v-model="form.gasIncluded" name="gasIncluded"><option value="NOT_INFORMED">No informado</option><option value="INCLUDED">Incluido</option><option value="NOT_INCLUDED">No incluido</option></select></label>
                <label>¿Se permiten mascotas?<select v-model="form.petsPolicy" name="petsPolicy"><option value="NOT_INFORMED">No informado</option><option value="ALLOWED">Permitidas</option><option value="NOT_ALLOWED">No permitidas</option><option value="ASK_OWNER">Consultar</option></select></label>
                <label>Fecha estimada de ingreso<input :value="form.availableFrom??''" name="availableFrom" type="date" @input="form.availableFrom=($event.target as HTMLInputElement).value||null" /></label>
              </div>
              <p class="owner-save-hint">Los servicios indican si están incluidos en el precio publicado, no si existen en la zona. La fecha es una estimación y no confirma disponibilidad.</p>
            </fieldset>
            <p v-if="selected && canEdit && dirty" class="owner-unsaved" role="status">Tenés cambios sin guardar. Guardalos antes de enviarlos a revisión o salir.</p>
            <p v-else-if="selected && !canEdit" class="owner-save-hint">La información queda en modo lectura mientras el equipo revisa o publica este alojamiento.</p>
            <p v-else-if="selected && canEdit" class="owner-save-hint">{{ formatRentalPrice(selected) }}</p>
            <div v-if="creating" class="owner-save-hint">Guardá el borrador para habilitar las secciones de fotografías y disponibilidad.</div>
            <div class="owner-form-actions">
              <button type="submit" :disabled="busy||loading||!canEdit">{{ busy?'Guardando…':selected?'Guardar cambios':'Guardar borrador' }}</button>
              <button v-if="selected && canEdit" type="button" class="secondary" :disabled="busy||loading||imageBusy!==null" @click="removeListing($event)">Eliminar borrador</button>
              <button v-if="canEdit && selected" type="button" class="secondary" :disabled="busy||loading||unsaved" @click="refreshSelected">Actualizar</button>
              <button v-if="canEdit && selected" type="button" :disabled="busy||dirty||imagesLoading||selectedPhoto!==null" @click="submit">{{ busy?'Enviando…':'Enviar a revisión' }}</button>
            </div>
          </form>

          <section v-else-if="activeOwnerSection==='photographs' && selected" id="owner-editor-panel" class="owner-photos owner-tab-panel" role="tabpanel" aria-labelledby="owner-tab-photographs" tabindex="0">
            <header class="owner-photos-heading"><div><p class="eyebrow">FOTOGRAFÍAS</p><h3 id="owner-images-title" tabindex="-1">Mostrá los detalles del lugar</h3><p class="owner-section-copy">Las fotos se guardan aparte de los cambios del alojamiento.</p></div><span class="owner-photo-count">{{ imagesLoadError?'—':`${images.length} / ${MAX_IMAGES}` }}</span></header>
            <div v-if="mediaConfigError&&session.mediaStrategy.value==='UNKNOWN'" class="owner-media-config-error" role="alert"><p>{{ mediaConfigError }}</p><button type="button" class="secondary" :disabled="mediaConfigLoading" @click="loadMediaConfig">{{ mediaConfigLoading?'Comprobando…':'Reintentar configuración de fotos' }}</button></div>
            <p v-else-if="mediaConfigLoading" class="owner-section-copy" role="status">Comprobando las opciones disponibles para las fotos…</p>
            <p v-else class="owner-section-copy">{{ hasRepositoryManagedImages?'Esta publicación tiene fotos administradas desde el repositorio; no se pueden combinar con nuevas cargas.':ownerUploadsEnabled?'JPEG, PNG o WebP. Hasta 1,8 MB por foto; optimizamos a 640 × 480 px. Las fotos nuevas se guardan de forma privada.':session.mediaStrategy.value==='STATIC_ASSETS'?'Las fotos de esta publicación son administradas desde el repositorio y solo se pueden consultar desde acá.':'La gestión de fotos no está habilitada en este entorno.' }}</p>
            <p v-if="imagesLoadError" class="error" role="alert">{{ imagesLoadError }} <button type="button" class="secondary" :disabled="imagesLoading" @click="retryLoadImages">Reintentar carga de fotos</button></p>
            <label v-if="canEdit&&ownerCanUpload&&images.length<MAX_IMAGES&&!selectedPhoto&&!mediaConfigLoading" class="owner-upload">Agregar fotografías<input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy||loading" @change="upload" /></label>
            <div v-if="selectedPhoto" class="owner-photo-preview" aria-label="Vista previa de la foto seleccionada">
              <img :src="selectedPhoto.previewUrl" :alt="`Vista previa de ${selectedPhoto.file.name}`" width="640" height="480" />
              <div><strong>{{ selectedPhoto.file.name }}</strong><small>{{ formatImageSize(selectedPhoto.file.size) }} · Vista previa, todavía no guardada</small></div>
              <div class="owner-image-actions"><button type="button" :disabled="busy" @click="uploadSelectedPhoto">{{ imageBusy==='upload'?'Guardando…':'Guardar foto' }}</button><button type="button" class="secondary" :disabled="busy" @click="discardSelectedPhoto">Cancelar</button></div>
            </div>
            <p v-if="imagesLoading" role="status">Cargando fotos…</p>
            <div v-else-if="!imagesLoadError&&!images.length" class="owner-photo-empty"><span aria-hidden="true">▧</span><div><strong>Todavía no hay fotografías</strong><p>{{ canEdit?'Elegí una foto para mostrar mejor tu alojamiento.':'Esta publicación no tiene fotos guardadas.' }}</p></div></div>
            <ul v-else-if="images.length" class="owner-image-grid" :aria-busy="imageBusy!==null">
              <li v-for="(image,index) in images" :key="image.id" class="owner-image-card" :class="{ 'is-cover':index===0 }">
                <div class="owner-image-frame"><img :src="apiUrl(`/listings/${encodeURIComponent(selected.id)}/images/${encodeURIComponent(image.id)}`)" :alt="`Foto ${index+1} de ${selected.title}`" width="640" height="480" loading="lazy" /><span v-if="index===0" class="owner-cover-label">Portada</span></div>
                <div class="owner-image-meta"><span><strong>{{ image.originalName }}</strong><small>{{ index+1 }} de {{ images.length }}<template v-if="image.source==='STATIC_ASSET'"> · Gestionada desde el repositorio</template></small></span><small>{{ formatImageSize(image.sizeBytes) }}</small></div>
                <div v-if="canEdit&&ownerUploadsEnabled&&image.source!=='STATIC_ASSET'" class="owner-image-actions"><button type="button" class="secondary" :disabled="busy||image.position===0" :aria-label="`Mover ${image.originalName} hacia arriba`" @click="moveImage(image,-1)">Subir</button><button type="button" class="secondary" :disabled="busy||image.position===mutableImages.length-1" :aria-label="`Mover ${image.originalName} hacia abajo`" @click="moveImage(image,1)">Bajar</button><button type="button" class="danger" :disabled="busy" :aria-label="`Eliminar ${image.originalName}`" @click="requestRemoveImage(image,$event)">Quitar</button></div>
              </li>
            </ul>
            <p v-if="selected.status==='APPROVED'&&images.length" class="owner-readonly-note">Las fotografías de una publicación aprobada se muestran en modo lectura.</p>
          </section>

          <section v-else-if="activeOwnerSection==='availability' && selected" id="owner-editor-panel" class="owner-availability-panel owner-tab-panel" role="tabpanel" aria-labelledby="owner-tab-availability" tabindex="0">
            <div class="owner-availability-summary"><span class="owner-availability-icon" aria-hidden="true">◷</span><div><p class="eyebrow">DISPONIBILIDAD DECLARADA</p><h3>{{ selected.availabilityStatus==='AVAILABLE'?'Disponible':'No disponible' }}</h3><p v-if="selected.lastConfirmedAt">Última confirmación <time :datetime="selected.lastConfirmedAt">{{ confirmedLabel }}</time> · hora local de Mendoza.</p><p v-else>{{ confirmedLabel }}</p></div></div>
            <div class="owner-availability-actions"><button type="button" :disabled="contactBusy!==''" @click="updateAvailability(selected.availabilityStatus==='AVAILABLE'?'UNAVAILABLE':'AVAILABLE')">{{ selected.availabilityStatus==='AVAILABLE'?'Marcar no disponible':'Marcar disponible' }}</button><button type="button" class="secondary" :disabled="contactBusy!==''" @click="reconfirmAvailability">{{ contactBusy==='availability'?'Confirmando…':'Confirmar que sigue vigente' }}</button></div>
            <p class="owner-availability-disclaimer">Es la última información que compartiste. Puede cambiar y no representa una reserva.</p>
          </section>

          <footer v-if="selected" class="owner-status-footer">
            <template v-if="selected.status==='SUBMITTED'"><strong>En revisión</strong><span>Podés consultar el estado desde esta pantalla.</span></template>
            <template v-else-if="selected.status==='APPROVED'"><strong>{{ selected.publicationStatus==='PUBLISHED'?'Visible en el catálogo':'Aprobada' }}</strong><RouterLink v-if="selected.publicationStatus==='PUBLISHED'" :to="`/listings/${selected.id}`">Ver ficha pública</RouterLink></template>
            <template v-else><strong>{{ selected.status==='REJECTED'?'Necesita correcciones':'Borrador privado' }}</strong><span>{{ selected.status==='REJECTED'?'Solo vos podés ver esta corrección.':'No se publica hasta que la envíes y el equipo la apruebe.' }}</span></template>
          </footer>
        </template>
        <div v-else class="owner-empty-editor"><span aria-hidden="true">⌂</span><h2>Elegí un alojamiento</h2><p>Seleccioná una publicación en la lista para revisar su estado y continuar.</p></div>
      </article>
    </section>

    <section id="owner-inbox" class="card owner-inbox" aria-labelledby="owner-inbox-title">
      <header class="owner-inbox-heading"><div><p class="eyebrow">Contacto directo</p><h2 id="owner-inbox-title">Consultas recibidas</h2><p>Mensajes de personas interesadas en tus alojamientos.</p></div><span v-if="unreadContacts" class="owner-unread-badge">{{ unreadContacts }} sin leer</span></header>
      <p v-if="contactsLoading" role="status">Cargando consultas…</p>
      <p v-if="contactsLoadError" class="error owner-load-error" role="alert">{{ contactsLoadError }} <button type="button" class="secondary" :disabled="contactsLoading" @click="loadContacts()">Reintentar carga de consultas</button></p>
      <p v-if="!contactsLoading&&!contactsLoadError&&!contacts.length" class="owner-inbox-empty">Todavía no recibiste consultas. Cuando alguien escriba por un alojamiento publicado, la vas a encontrar acá.</p>
      <ul v-else-if="contacts.length" class="owner-contact-list">
        <li v-for="event in contacts" :key="event.id" class="owner-contact-card" :class="{unread:event.state==='UNREAD'}">
          <div class="owner-contact-top"><div><span class="owner-contact-state">{{ event.state==='UNREAD'?'Nueva consulta':'Leída' }}</span><h3>{{ event.visitorName }}</h3></div><time :datetime="event.createdAt">{{ new Date(event.createdAt).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}) }}</time></div>
          <p class="owner-contact-listing">{{ event.listing.title }} · {{ event.listing.location }}</p>
          <p class="owner-contact-message">{{ event.message }}</p>
          <div class="owner-contact-actions"><a :href="`mailto:${event.visitorEmail}`">Responder a {{ event.visitorEmail }}</a><button type="button" class="secondary" :disabled="contactBusy===event.id" @click="setContactState(event,event.state==='UNREAD'?'READ':'UNREAD')">{{ contactBusy===event.id?'Guardando…':event.state==='UNREAD'?'Marcar leída':'Marcar sin leer' }}</button></div>
        </li>
      </ul>
      <button v-if="nextContactCursor" type="button" class="secondary" :disabled="contactsLoading" @click="loadMoreContacts">Ver consultas anteriores</button>
    </section>

    <div v-if="pendingImageDelete && selected" class="owner-dialog-backdrop">
      <section ref="imageDeleteDialog" class="owner-confirmation owner-dialog" role="alertdialog" aria-modal="true" aria-labelledby="owner-image-delete-title" aria-describedby="owner-image-delete-copy" @keydown="trapDialogFocus($event,imageDeleteDialog,closeImageDelete)">
        <p class="eyebrow">Eliminar foto</p><h2 id="owner-image-delete-title">¿Quitar “{{ pendingImageDelete.originalName }}”?</h2><p id="owner-image-delete-copy">La foto se eliminará de este alojamiento. El resto de las imágenes conserva su orden.</p>
        <div class="owner-confirm-actions"><button type="button" class="danger" :disabled="busy" @click="removeImage">{{ busy?'Eliminando…':'Eliminar foto' }}</button><button data-dialog-initial-focus type="button" class="secondary" :disabled="busy" @click="closeImageDelete">Conservar foto</button></div>
      </section>
    </div>
    <div v-if="confirmDelete && selected" class="owner-dialog-backdrop">
      <section ref="listingDeleteDialog" class="owner-confirmation owner-dialog" role="alertdialog" aria-modal="true" aria-labelledby="owner-delete-title" aria-describedby="owner-delete-copy" @keydown="trapDialogFocus($event,listingDeleteDialog,closeListingDelete)">
        <p class="eyebrow">Acción permanente</p><h2 id="owner-delete-title">¿Eliminar “{{ selected.title }}”?</h2><p id="owner-delete-copy">Se eliminará el borrador y sus fotos guardadas. Esta acción no se puede deshacer.</p>
        <div class="owner-confirm-actions"><button type="button" class="danger" :disabled="busy" @click="confirmRemoveListing">{{ busy?'Eliminando…':'Eliminar alojamiento' }}</button><button data-dialog-initial-focus type="button" class="secondary" :disabled="busy" @click="closeListingDelete">Conservar borrador</button></div>
      </section>
    </div>
    <div v-if="confirmLeave" class="owner-dialog-backdrop">
      <section ref="leaveDialog" class="owner-confirmation owner-dialog" role="alertdialog" aria-modal="true" aria-labelledby="owner-leave-title" aria-describedby="owner-leave-copy" @keydown="trapDialogFocus($event,leaveDialog,()=>resolvePendingLeave(false))">
        <p class="eyebrow">Cambios pendientes</p><h2 id="owner-leave-title">¿Salir sin guardar?</h2><p id="owner-leave-copy">Los cambios que hiciste en este borrador todavía no están guardados.</p>
        <div class="owner-confirm-actions"><button type="button" @click="resolvePendingLeave(true)">Salir y descartar cambios</button><button data-dialog-initial-focus type="button" class="secondary" @click="resolvePendingLeave(false)">Seguir editando</button></div>
      </section>
    </div>
    <div v-if="pendingSelection" class="owner-dialog-backdrop">
      <section ref="selectionDialog" class="owner-confirmation owner-dialog" role="alertdialog" aria-modal="true" aria-labelledby="owner-selection-title" aria-describedby="owner-selection-copy" @keydown="trapDialogFocus($event,selectionDialog,cancelChoose)">
        <p class="eyebrow">Cambiar de alojamiento</p><h2 id="owner-selection-title">¿Descartar tus cambios?</h2><p id="owner-selection-copy">Los cambios actuales todavía no están guardados.</p>
        <div class="owner-confirm-actions"><button type="button" :disabled="busy" @click="confirmChoose">Descartar y cambiar</button><button data-dialog-initial-focus type="button" class="secondary" @click="cancelChoose">Seguir editando</button></div>
      </section>
    </div>
    <div v-if="confirmReload" class="owner-dialog-backdrop">
      <section ref="reloadDialog" class="owner-confirmation owner-dialog" role="alertdialog" aria-modal="true" aria-labelledby="owner-reload-title" aria-describedby="owner-reload-copy" @keydown="trapDialogFocus($event,reloadDialog,cancelReload)">
        <p class="eyebrow">Actualizar publicaciones</p><h2 id="owner-reload-title">Hay cambios sin guardar</h2><p id="owner-reload-copy">Al actualizar vas a reemplazar lo que editaste por la última versión guardada.</p>
        <div class="owner-confirm-actions"><button type="button" :disabled="busy||loading" @click="discardAndReload">Descartar y actualizar</button><button data-dialog-initial-focus type="button" class="secondary" @click="cancelReload">Seguir editando</button></div>
      </section>
    </div>
  </section>
</template>
