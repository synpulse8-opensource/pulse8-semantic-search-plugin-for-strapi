import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { PLUGIN_API_PREFIX } from '../pluginId';

export interface IApiSettingsResponseDTO {
  apiKey: string;
  embeddingUrl: string;
  embeddingModel: string;
}

interface IInitialApiState {
  apiKey: string;
  embeddingUrl: string;
  embeddingModel: string;
}

export const useApiSettings = () => {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [apiKey, setApiKey] = useState('');
  const [embeddingUrl, setEmbeddingUrl] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [initialState, setInitialState] = useState<IInitialApiState | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await get<IApiSettingsResponseDTO>(`${PLUGIN_API_PREFIX}/api-settings`);
      const loadedApiKey = response.data.apiKey || '';
      const loadedEmbeddingUrl = response.data.embeddingUrl || '';
      const loadedEmbeddingModel = response.data.embeddingModel || '';

      setApiKey(loadedApiKey);
      setEmbeddingUrl(loadedEmbeddingUrl);
      setEmbeddingModel(loadedEmbeddingModel);
      setInitialState({
        apiKey: loadedApiKey,
        embeddingUrl: loadedEmbeddingUrl,
        embeddingModel: loadedEmbeddingModel,
      });
    } catch (error) {
      console.error('Error loading API settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const response = await post<IApiSettingsResponseDTO>(`${PLUGIN_API_PREFIX}/api-settings`, {
        apiKey,
        embeddingUrl,
        embeddingModel,
      });
      const savedApiKey = response.data.apiKey || '';
      const savedEmbeddingUrl = response.data.embeddingUrl || '';
      const savedEmbeddingModel = response.data.embeddingModel || '';

      setApiKey(savedApiKey);
      setEmbeddingUrl(savedEmbeddingUrl);
      setEmbeddingModel(savedEmbeddingModel);
      setInitialState({
        apiKey: savedApiKey,
        embeddingUrl: savedEmbeddingUrl,
        embeddingModel: savedEmbeddingModel,
      });
      toggleNotification({ type: 'success', message: 'Successfully updated settings' });
    } catch (error) {
      console.error('Error saving API settings:', error);
      toggleNotification({ type: 'danger', message: 'An error has occurred, please try again' });
    }
  };

  const isDirty =
    initialState !== null &&
    (apiKey !== initialState.apiKey ||
      embeddingUrl !== initialState.embeddingUrl ||
      embeddingModel !== initialState.embeddingModel);

  return {
    apiKey,
    setApiKey,
    embeddingUrl,
    setEmbeddingUrl,
    embeddingModel,
    setEmbeddingModel,
    saveSettings,
    isLoading,
    isDirty,
  };
};
