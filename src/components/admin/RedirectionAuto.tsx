'use client';

import { useEffect } from 'react';

/** Navigation complète vers une adresse (ex. la carte imprimable, qui n'est pas une page React). */
export function RedirectionAuto({ href }: { href: string }) {
  useEffect(() => { window.location.replace(href); }, [href]);
  return null;
}
