import { useEffect, useState } from 'react';

/** True while the CSS media query matches (false where matchMedia is unavailable, e.g. tests). */
export function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const h = () => setMatches(mql.matches);
    h();
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, [query]);
  return matches;
}

export const MOBILE_QUERY = '(max-width: 640px)';
