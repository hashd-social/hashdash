/**
 * useHashdUrl Hook
 * 
 * Converts hashd:// URLs to blob URLs for use in standard HTML elements
 */

import { useState, useEffect } from 'react';
import { useByteCave } from './useByteCave';

interface UseHashdUrlResult {
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to convert hashd:// URLs to blob URLs
 * 
 * @example
 * const { blobUrl, loading, error } = useHashdUrl('hashd://abc123...');
 * return <img src={blobUrl || ''} alt="..." />;
 */
export function useHashdUrl(hashdUrl: string | null | undefined): UseHashdUrlResult {
  const { client, retrieve } = useByteCave();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when URL changes
    if (!hashdUrl || !hashdUrl.startsWith('hashd://')) {
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!client) {
      setError('ByteCave client not initialized');
      return;
    }

    // Extract CID from hashd:// URL
    const cid = hashdUrl.replace('hashd://', '').split('?')[0];

    let mounted = true;
    setLoading(true);
    setError(null);

    // Fetch content and create blob URL
    retrieve(cid)
      .then(result => {
        if (!mounted) return;

        if (result.success && result.data) {
          // Create blob URL (copy data to avoid SharedArrayBuffer issues)
          const dataCopy = new Uint8Array(result.data);
          const blob = new Blob([dataCopy]);
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        } else {
          setError(result.error || 'Failed to retrieve content');
          setLoading(false);
        }
      })
      .catch(err => {
        if (!mounted) return;
        setError(err.message || 'Failed to retrieve content');
        setLoading(false);
      });

    // Cleanup: revoke blob URL when component unmounts or URL changes
    return () => {
      mounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashdUrl, client]);

  return { blobUrl, loading, error };
}
