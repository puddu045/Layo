import { useEffect, useState } from 'react';
import type { Me } from '@layo/contracts';
import { api } from './api-client';

/** Who is signed in, and whether they're an admin — fetched once per mount.
 * `undefined` means still loading; `null` means the lookup failed. */
export function useCurrentUser() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Me>('/auth/me')
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}
