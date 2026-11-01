import { computed, ref } from 'vue';
import { ApiError, request, type Role, type User } from './api';

export type SessionStatus =
  'unknown' | 'loading' | 'authenticated' | 'anonymous' | 'error';
export type AuthStrategy = 'PASSWORD' | 'ACCESS_PREVIEW' | 'UNKNOWN';
export type MediaStrategy = 'STATIC_ASSETS' | 'D1_BLOB' | 'R2' | 'UNKNOWN';
const status = ref<SessionStatus>('unknown');
const user = ref<User | null>(null);
const authStrategy = ref<AuthStrategy>('UNKNOWN');
const mediaStrategy = ref<MediaStrategy>('UNKNOWN');
let restorePromise: Promise<void> | undefined;
let previewRefreshPromise: Promise<User> | undefined;
let authConfigPromise: Promise<Exclude<AuthStrategy, 'UNKNOWN'>> | undefined;
let onSessionExpired: (() => void) | undefined;
let previewRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let previewSessionExpiresAt: number | undefined;
let sessionGeneration=0;
let logoutInFlight=false;
let sessionEventsInstalled=false;
let renewOnReturn:(()=>void)|undefined;

export function setSessionExpiredHandler(handler: (() => void) | undefined) {
  onSessionExpired = handler;
}

export function useSession() {
  const isAuthenticated = computed(
    () => status.value === 'authenticated' && Boolean(user.value),
  );
  const role = computed<Role | null>(() => user.value?.role ?? null);

  async function clear() {
    const expiresAt=previewSessionExpiresAt;
    logoutInFlight=true;sessionGeneration++;cancelPreviewRefresh();
    let revoked=false;
    try{
      const result=await request<{ok?:boolean}>('/auth/logout', { method: 'POST' });
      if(result.ok!==true)throw new ApiError(401,'The server did not confirm session revocation');
      revoked=true;anonymous();
    }finally{
      logoutInFlight=false;
      if(!revoked&&expiresAt!==undefined&&status.value==='authenticated')schedulePreviewRefresh(expiresAt);
    }
  }

  function anonymous() {
    sessionGeneration++;cancelPreviewRefresh();
    status.value = 'anonymous';
    user.value = null;
  }

  function cancelPreviewRefresh(){
    if(previewRefreshTimer!==undefined)clearTimeout(previewRefreshTimer);
    previewRefreshTimer=undefined;previewSessionExpiresAt=undefined;
  }

  function schedulePreviewRefresh(expiresAt:number|undefined){
    cancelPreviewRefresh();
    if(authStrategy.value!=='ACCESS_PREVIEW'||status.value!=='authenticated'||!Number.isSafeInteger(expiresAt))return;
    const remaining=expiresAt!*1000-Date.now();
    if(remaining<=0)return;
    previewSessionExpiresAt=expiresAt;
    const generation=sessionGeneration;
    previewRefreshTimer=setTimeout(()=>{
      previewRefreshTimer=undefined;
      if(generation!==sessionGeneration||logoutInFlight)return;
      void renewPreviewSession().catch(error=>{
        if(generation!==sessionGeneration||logoutInFlight)return;
        if(error instanceof ApiError&&[401,403].includes(error.status)){anonymous();onSessionExpired?.();}
        else{cancelPreviewRefresh();status.value='error';}
      });
    },Math.max(250,Math.min(10*60*1000,Math.floor(remaining*0.7))));
  }

  async function renewWhenReturning(){
    if(logoutInFlight||status.value!=='authenticated'||authStrategy.value!=='ACCESS_PREVIEW'||!previewSessionExpiresAt)return;
    if(previewSessionExpiresAt*1000-Date.now()<=60_000){
      try{await renewPreviewSession();}
      catch(error){if(error instanceof ApiError&&[401,403].includes(error.status)){anonymous();onSessionExpired?.();}else{status.value='error';}}
    }
  }

  if(typeof window!=='undefined'){
    renewOnReturn=renewWhenReturning;
    if(!sessionEventsInstalled){
      const onReturn=()=>{void renewOnReturn?.();};
      window.addEventListener('focus',onReturn);
      window.addEventListener('pageshow',onReturn);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')onReturn();});
      sessionEventsInstalled=true;
    }
  }

  async function authenticate(
    path: '/auth/login',
    email: string,
    password: string,
  ) {
    const result = await request<{ user: User }>(path, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    status.value = 'authenticated';
    user.value = result.user;
  }

  async function loadAuthStrategy() {
    if(authStrategy.value!=='UNKNOWN'&&mediaStrategy.value!=='UNKNOWN')return authStrategy.value;
    if(!authConfigPromise){
      authConfigPromise=request<{strategy:string;mediaStrategy?:string}>('/auth/config').then(config=>{
        if(config.strategy!=='PASSWORD'&&config.strategy!=='ACCESS_PREVIEW')throw Error('Unsupported authentication');
        authStrategy.value=config.strategy;
        mediaStrategy.value=config.mediaStrategy==='STATIC_ASSETS'||config.mediaStrategy==='D1_BLOB'||config.mediaStrategy==='R2'?config.mediaStrategy:'UNKNOWN';
        return config.strategy;
      });
    }
    const pending=authConfigPromise;
    try{return await pending;}finally{if(authConfigPromise===pending)authConfigPromise=undefined;}
  }

  async function renewPreviewSession() {
    if(authStrategy.value!=='ACCESS_PREVIEW')throw new ApiError(401,'Preview session renewal is unavailable');
    if(!previewRefreshPromise){
      const generation=sessionGeneration;
      previewRefreshPromise=request<{user?:User;sessionExpiresAt?:number}>('/auth/refresh',{method:'POST'}).then(result=>{
        if(!result.user||!['OWNER','ADMIN'].includes(result.user.role)||!result.user.id||!result.user.email)
          throw new ApiError(401,'Preview session renewal was rejected');
        if(generation!==sessionGeneration||logoutInFlight)throw new ApiError(401,'Preview session ended');
        user.value=result.user;
        status.value='authenticated';
        schedulePreviewRefresh(result.sessionExpiresAt);
        return result.user;
      }).finally(()=>{previewRefreshPromise=undefined;});
    }
    return previewRefreshPromise;
  }

  function replayable(options:RequestInit){
    const body=options.body;
    return body===undefined||typeof body==='string'||body instanceof FormData||body instanceof Blob||body instanceof URLSearchParams||body instanceof ArrayBuffer||ArrayBuffer.isView(body);
  }

  async function authenticatePreview(role: Extract<Role,'OWNER'|'ADMIN'>) {
    if(authStrategy.value!=='ACCESS_PREVIEW')throw Error('Preview identity selection is unavailable');
    cancelPreviewRefresh();sessionGeneration++;
    const result = await request<{ user: User;sessionExpiresAt?:number }>('/auth/preview-session', { method: 'POST', body:JSON.stringify({role}) });
    status.value = 'authenticated';
    user.value = result.user;
    schedulePreviewRefresh(result.sessionExpiresAt);
  }

  async function restore() {
    if (restorePromise) return restorePromise;
    status.value = 'loading';
    restorePromise = request<User&{sessionExpiresAt?:number}>('/auth/me')
      .then((restored) => {
        user.value = restored;
        status.value = 'authenticated';
        schedulePreviewRefresh(restored.sessionExpiresAt);
      })
      .catch(async (error) => {
        if(error instanceof ApiError&&error.status===401){
          try{
            if(await loadAuthStrategy()==='ACCESS_PREVIEW'){
              await renewPreviewSession();
              const restored=await request<User&{sessionExpiresAt?:number}>('/auth/me');
              user.value=restored;status.value='authenticated';schedulePreviewRefresh(restored.sessionExpiresAt);return;
            }
          }catch(refreshError){
            if(!(refreshError instanceof ApiError)||![401,403].includes(refreshError.status)){status.value='error';throw refreshError;}
          }
          user.value=null;status.value='anonymous';return;
        }
        user.value = null;
        status.value = 'error';
        throw error;
      })
      .finally(() => {
        restorePromise = undefined;
      });
    return restorePromise;
  }

  async function apiRequest<T>(path: string, options: RequestInit = {}) {
    try {
      return await request<T>(path, options);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        if(status.value==='authenticated'&&replayable(options)){
          let renewed=false;
          try{
            if(await loadAuthStrategy()==='ACCESS_PREVIEW'){
              await renewPreviewSession();
              renewed=true;
            }
          }catch(refreshError){
            if(!(refreshError instanceof ApiError)||![401,403].includes(refreshError.status))throw refreshError;
          }
          if(renewed)return request<T>(path,options);
        }
        anonymous();onSessionExpired?.();
      }
      throw error;
    }
  }

  return {
    token: computed(() => status.value === 'authenticated'),
    status,
    user,
    role,
    authStrategy,
    mediaStrategy,
    isAuthenticated,
    authenticate,
    authenticatePreview,
    loadAuthStrategy,
    restore,
    clear,
    anonymous,
    apiRequest,
  };
}
