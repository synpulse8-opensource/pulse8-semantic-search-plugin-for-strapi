import { useFetchClient } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { PLUGIN_API_PREFIX } from '../pluginId';

export interface IContentTypeStats {
  total: number;
  withEmbeddings: number;
  coverage: number;
}

export interface IStatsData {
  [contentType: string]: IContentTypeStats;
}

export interface IStatsResponseDTO {
  success: boolean;
  data: IStatsData;
}

export interface IRegenerateResponseDTO {
  success: boolean;
  data: {
    contentType: string;
    locale: string;
    total: number;
    processed: number;
    failed: number;
  };
}

export interface IDeleteResponseDTO {
  success: boolean;
  data: {
    contentType: string;
    deleted: number;
  };
}

export const useStats = () => {
  const { get, post } = useFetchClient();
  const [stats, setStats] = useState<IStatsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingContentType, setRegeneratingContentType] = useState<string | null>(null);
  const [deletingContentType, setDeletingContentType] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await get<IStatsResponseDTO>(`${PLUGIN_API_PREFIX}/stats`);
      if (response.data.success) {
        setStats(response.data.data || {});
      } else {
        setError('Failed to load stats');
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = () => {
    loadStats();
  };

  const regenerateContentType = async (contentType: string) => {
    try {
      setRegeneratingContentType(contentType);
      await post<IRegenerateResponseDTO>(`${PLUGIN_API_PREFIX}/regenerate`, {
        contentType,
        locale: 'en',
      });
      await loadStats();
    } catch (err) {
      console.error('Error regenerating embeddings:', err);
      setError('Failed to regenerate embeddings');
    } finally {
      setRegeneratingContentType(null);
    }
  };

  const regenerateAll = async () => {
    const contentTypes = Object.keys(stats);
    if (contentTypes.length === 0) return;

    try {
      setRegeneratingContentType('all');
      for (const contentType of contentTypes) {
        await post<IRegenerateResponseDTO>(`${PLUGIN_API_PREFIX}/regenerate`, {
          contentType,
          locale: 'en',
        });
      }
      await loadStats();
    } catch (err) {
      console.error('Error regenerating all embeddings:', err);
      setError('Failed to regenerate embeddings');
    } finally {
      setRegeneratingContentType(null);
    }
  };

  const deleteContentType = async (contentType: string) => {
    try {
      setDeletingContentType(contentType);
      await post<IDeleteResponseDTO>(`${PLUGIN_API_PREFIX}/delete`, {
        contentType,
      });
      await loadStats();
    } catch (err) {
      console.error('Error deleting embeddings:', err);
      setError('Failed to delete embeddings');
    } finally {
      setDeletingContentType(null);
    }
  };

  const deleteAll = async () => {
    const contentTypes = Object.keys(stats);
    if (contentTypes.length === 0) return;

    try {
      setDeletingContentType('all');
      for (const contentType of contentTypes) {
        await post<IDeleteResponseDTO>(`${PLUGIN_API_PREFIX}/delete`, {
          contentType,
        });
      }
      await loadStats();
    } catch (err) {
      console.error('Error deleting all embeddings:', err);
      setError('Failed to delete embeddings');
    } finally {
      setDeletingContentType(null);
    }
  };

  return {
    stats,
    isLoading,
    error,
    refetch,
    regenerateContentType,
    regenerateAll,
    regeneratingContentType,
    deleteContentType,
    deleteAll,
    deletingContentType,
  };
};
