import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { PLUGIN_API_PREFIX } from '../pluginId';

export interface IContentTypeConfig {
  contentType: string;
  fields: string[];
  fieldsRaw?: string;
}

export interface IPluginSettingsResponseDTO {
  autoGenerate: boolean;
  contentTypes: {
    contentType: string;
    fields: string[];
  }[];
  searchLimit: number;
  searchThreshold: number;
  searchLocale: string;
}

export interface IValidationErrors {
  [index: number]: {
    contentType?: string;
    fields?: string;
  };
}

interface IInitialPluginState {
  contentTypes: IContentTypeConfig[];
  autoGenerate: boolean;
  searchLimit: number;
  searchThreshold: number;
  searchLocale: string;
}

const areContentTypesEqual = (a: IContentTypeConfig[], b: IContentTypeConfig[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((ct, index) => {
    const other = b[index];
    return ct.contentType === other.contentType && ct.fieldsRaw === other.fieldsRaw;
  });
};

export const usePluginSettings = () => {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [contentTypes, setContentTypes] = useState<IContentTypeConfig[]>([]);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [searchLimit, setSearchLimit] = useState<number | undefined>();
  const [searchThreshold, setSearchThreshold] = useState<number | undefined>();
  const [searchLocale, setSearchLocale] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<IValidationErrors>({});
  const [initialState, setInitialState] = useState<IInitialPluginState | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await get<IPluginSettingsResponseDTO>(
        `${PLUGIN_API_PREFIX}/plugin-settings`
      );
      const loadedContentTypes = response.data.contentTypes || [];
      const contentTypesWithRaw = loadedContentTypes.map((ct) => ({
        ...ct,
        fieldsRaw: ct.fields ? ct.fields.join(', ') : '',
      }));
      const loadedAutoGenerate = response.data.autoGenerate;
      const loadedSearchLimit = response.data.searchLimit;
      const loadedSearchThreshold = response.data.searchThreshold;
      const loadedSearchLocale = response.data.searchLocale;

      setContentTypes(contentTypesWithRaw);
      setAutoGenerate(loadedAutoGenerate);
      setSearchLimit(loadedSearchLimit);
      setSearchThreshold(loadedSearchThreshold);
      setSearchLocale(loadedSearchLocale);
      setInitialState({
        contentTypes: contentTypesWithRaw.map((ct) => ({ ...ct })),
        autoGenerate: loadedAutoGenerate,
        searchLimit: loadedSearchLimit,
        searchThreshold: loadedSearchThreshold,
        searchLocale: loadedSearchLocale,
      });
    } catch (error) {
      console.error('Error loading plugin settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const processedContentTypes = contentTypes.map((ct) => ({
        contentType: ct.contentType,
        fields: ct.fieldsRaw
          ? ct.fieldsRaw
              .split(',')
              .map((f) => f.trim())
              .filter(Boolean)
          : ct.fields,
      }));

      const response = await post<IPluginSettingsResponseDTO>(
        `${PLUGIN_API_PREFIX}/plugin-settings`,
        {
          autoGenerate,
          contentTypes: processedContentTypes,
          searchLimit,
          searchThreshold,
          searchLocale,
        }
      );

      const savedContentTypes = response.data.contentTypes || [];
      const contentTypesWithRaw = savedContentTypes.map((ct) => ({
        ...ct,
        fieldsRaw: ct.fields ? ct.fields.join(', ') : '',
      }));
      const savedAutoGenerate = response.data.autoGenerate;
      const savedSearchLimit = response.data.searchLimit;
      const savedSearchThreshold = response.data.searchThreshold;
      const savedSearchLocale = response.data.searchLocale;

      setContentTypes(contentTypesWithRaw);
      setAutoGenerate(savedAutoGenerate);
      setSearchLimit(savedSearchLimit);
      setSearchThreshold(savedSearchThreshold);
      setSearchLocale(savedSearchLocale);
      setInitialState({
        contentTypes: contentTypesWithRaw.map((ct) => ({ ...ct })),
        autoGenerate: savedAutoGenerate,
        searchLimit: savedSearchLimit,
        searchThreshold: savedSearchThreshold,
        searchLocale: savedSearchLocale,
      });
      toggleNotification({ type: 'success', message: 'Successfully updated settings' });
    } catch (error) {
      console.error('Error saving plugin settings:', error);
      toggleNotification({ type: 'danger', message: 'An error has occurred, please try again' });
    }
  };

  const validateAndSave = () => {
    const errors: IValidationErrors = {};
    let hasErrors = false;

    contentTypes.forEach((ct, index) => {
      const rowErrors: { contentType?: string; fields?: string } = {};

      if (!ct.contentType || ct.contentType.trim() === '') {
        rowErrors.contentType = 'Content type is required';
        hasErrors = true;
      }

      if (!ct.fieldsRaw || ct.fieldsRaw.trim() === '') {
        rowErrors.fields = 'Field(s) are required';
        hasErrors = true;
      }

      if (Object.keys(rowErrors).length > 0) {
        errors[index] = rowErrors;
      }
    });

    setValidationErrors(errors);

    if (!hasErrors) {
      saveSettings();
    }
  };

  const addContentType = () => {
    setContentTypes([...contentTypes, { contentType: '', fields: [], fieldsRaw: '' }]);
  };

  const removeContentType = (index: number) => {
    setContentTypes(contentTypes.filter((_, i) => i !== index));
    // Re-index validation errors
    setValidationErrors((prev) => {
      const newErrors: IValidationErrors = {};
      Object.keys(prev).forEach((key) => {
        const keyNum = parseInt(key);
        if (keyNum < index) {
          newErrors[keyNum] = prev[keyNum];
        } else if (keyNum > index) {
          newErrors[keyNum - 1] = prev[keyNum];
        }
      });
      return newErrors;
    });
  };

  const updateContentType = (index: number, value: string) => {
    const updated = [...contentTypes];
    updated[index].contentType = value;
    setContentTypes(updated);
    // Clear validation error when user starts typing
    if (validationErrors[index]?.contentType) {
      setValidationErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], contentType: undefined },
      }));
    }
  };

  const updateFields = (index: number, value: string) => {
    const updated = [...contentTypes];
    updated[index].fieldsRaw = value;
    setContentTypes(updated);
    // Clear validation error when user starts typing
    if (validationErrors[index]?.fields) {
      setValidationErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], fields: undefined },
      }));
    }
  };

  const isDirty =
    initialState !== null &&
    (autoGenerate !== initialState.autoGenerate ||
      searchLimit !== initialState.searchLimit ||
      searchThreshold !== initialState.searchThreshold ||
      searchLocale !== initialState.searchLocale ||
      !areContentTypesEqual(contentTypes, initialState.contentTypes));

  return {
    contentTypes,
    setContentTypes,
    autoGenerate,
    setAutoGenerate,
    searchLimit,
    setSearchLimit,
    searchThreshold,
    setSearchThreshold,
    searchLocale,
    setSearchLocale,
    saveSettings,
    validateAndSave,
    validationErrors,
    isLoading,
    isDirty,
    addContentType,
    removeContentType,
    updateContentType,
    updateFields,
  };
};
