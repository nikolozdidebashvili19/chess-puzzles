// Hash router: works on any static host without rewrite rules.
import { useSyncExternalStore } from 'react';

const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash.replace(/^#/, '') || '/';

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash);
  const [path, query = ''] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path, parts, query: new URLSearchParams(query) };
}

export function navigate(to) {
  window.location.hash = to;
  window.scrollTo({ top: 0 });
}
