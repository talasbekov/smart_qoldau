'use client';

import { useEffect } from 'react';
import { documentSessionEpoch, sessionEpoch } from '@/lib/auth/browser-session';
import { reloadSessionDocument } from '@/lib/auth/session-navigation';

export default function SessionBoundary() {
  useEffect(() => {
    const check = () => {
      try {
        if (documentSessionEpoch() !== sessionEpoch()) reloadSessionDocument();
      } catch {
        // Authenticated actions fail closed when storage is unavailable.
      }
    };
    window.addEventListener('storage', check);
    window.addEventListener('pageshow', check);
    check();
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('pageshow', check);
    };
  }, []);
  return null;
}
