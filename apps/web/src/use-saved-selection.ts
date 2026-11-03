import { computed, ref } from 'vue';
import { MAX_SAVED_LISTINGS, SELECTION_STORAGE_KEY, normalizeSelection, parseSelection, serializeSelection, toggleSelection } from './selection-store';

const storageError = ref(false);
function readInitial(): string[] {
  try { return parseSelection(window.localStorage.getItem(SELECTION_STORAGE_KEY)); }
  catch { storageError.value = true; return []; }
}

const ids = ref<string[]>(typeof window === 'undefined' ? [] : readInitial());
let storageListenerInstalled = false;

function installStorageListener() {
  if (storageListenerInstalled || typeof window === 'undefined') return;
  storageListenerInstalled = true;
  window.addEventListener('storage', event => {
    if (event.key !== SELECTION_STORAGE_KEY) return;
    ids.value = parseSelection(event.newValue);
    storageError.value = false;
  });
}

export function useSavedSelection() {
  installStorageListener();
  const count = computed(() => ids.value.length);

  function persist(next: string[]): boolean {
    try {
      window.localStorage.setItem(SELECTION_STORAGE_KEY, serializeSelection(next));
      ids.value = next;
      storageError.value = false;
      return true;
    } catch {
      storageError.value = true;
      return false;
    }
  }

  function toggle(id: string) {
    const result = toggleSelection(ids.value, id);
    if (!result.limitReached && result.ids !== ids.value) persist(result.ids);
    return result;
  }

  function remove(id: string) {
    const next = ids.value.filter(value => value !== id);
    if (next.length !== ids.value.length) persist(next);
  }

  function isSaved(id: string) { return ids.value.includes(id); }

  return { ids, count, storageError, max: MAX_SAVED_LISTINGS, toggle, remove, isSaved };
}
