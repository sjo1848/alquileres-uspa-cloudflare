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
let onSessionExpired: (() => void) | undefined;

export function setSessionExpiredHandler(handler: (() => void) | undefined) {
  onSessionExpired = handler;
}

export function useSession() {
  const isAuthenticated = computed(
    () => status.value === 'authenticated' && Boolean(user.value),
  );
  const role = computed<Role | null>(() => user.value?.role ?? null);

  async function clear() {
    await request('/auth/logout', { method: 'POST' });
    anonymous();
  }

  function anonymous() {
    status.value = 'anonymous';
    user.value = null;
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
    const config = await request<{strategy:string;mediaStrategy?:string}>('/auth/config');
    if(config.strategy!=='PASSWORD'&&config.strategy!=='ACCESS_PREVIEW')throw Error('Unsupported authentication');
    authStrategy.value=config.strategy;
    mediaStrategy.value=config.mediaStrategy==='STATIC_ASSETS'||config.mediaStrategy==='D1_BLOB'||config.mediaStrategy==='R2'?config.mediaStrategy:'UNKNOWN';
    return authStrategy.value;
  }

  async function authenticatePreview(role: Extract<Role,'OWNER'|'ADMIN'>) {
    if(authStrategy.value!=='ACCESS_PREVIEW')throw Error('Preview identity selection is unavailable');
    const result = await request<{ user: User }>('/auth/preview-session', { method: 'POST', body:JSON.stringify({role}) });
    status.value = 'authenticated';
    user.value = result.user;
  }

  async function restore() {
    if (restorePromise) return restorePromise;
    status.value = 'loading';
    restorePromise = request<User>('/auth/me')
      .then((restored) => {
        user.value = restored;
        status.value = 'authenticated';
      })
      .catch((error) => {
        user.value = null;
        if (error instanceof ApiError && error.status === 401) {
          status.value = 'anonymous';
          return;
        }
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
        anonymous();
        onSessionExpired?.();
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
