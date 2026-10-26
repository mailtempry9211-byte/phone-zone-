
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StorageUsage {
  totalSize: number;
  formattedSize: string;
  fileCount: number;
  isLoading: boolean;
  error: string | null;
}

export const useStorageUsage = () => {
  const [usage, setUsage] = useState<StorageUsage>({
    totalSize: 0,
    formattedSize: '0 MB',
    fileCount: 0,
    isLoading: true,
    error: null
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchStorageUsage = async () => {
    try {
      setUsage(prev => ({ ...prev, isLoading: true, error: null }));

      // Single source of truth: the local backend reports total usage across
      // ALL file owner types (phones, sellers, customers, repairs, invoices,
      // buckets, admin). Do not fall back to one Supabase bucket - that would
      // report a fraction of the real storage as if it were everything.
      const res = await fetch('/api/storage/usage', {
        credentials: 'include',
      });

      if (!res.ok) {
        // Only the offline shim / local backend exposes this endpoint.
        // In a hosted Supabase build it will 404, so surface a clear message
        // instead of silently showing the wrong number.
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Storage usage is unavailable (${res.status}).`);
      }

      const data = await res.json();
      const totalSize = Number(data.totalBytes || 0);
      const fileCount = Number(data.fileCount || 0);

      setUsage({
        totalSize,
        formattedSize: formatBytes(totalSize),
        fileCount,
        isLoading: false,
        error: null,
      });

    } catch (error) {
      console.error('Error fetching storage usage:', error);
      setUsage(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch storage usage',
      }));
    }
  };

  useEffect(() => {
    fetchStorageUsage();
  }, []);

  return { ...usage, refresh: fetchStorageUsage };
};
