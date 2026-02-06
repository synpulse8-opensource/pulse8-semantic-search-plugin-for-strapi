import crypto from 'crypto';
import { PLUGIN_ID } from '../pluginId';

export interface IContentTypeConfig {
  contentType: string;
  fields: string[];
  embeddingFields: string[];
  responseFields: string[];
}

export interface ISettings {
  encryptedApiKey: string | null;
  embeddingUrl: string;
  embeddingModel: string;
  autoGenerate: boolean;
  contentTypes: IContentTypeConfig[];
  searchLimit: number;
  searchThreshold: number;
  searchLocale: string;
}

// Use Strapi's APP_KEYS for encryption (required in all Strapi installations)
// Strapi Cloud and most hosting providers allow setting APP_KEYS via their dashboard
const getEncryptionKey = (): Buffer => {
  const key = process.env.APP_KEYS?.split(',')[0];
  if (!key) {
    throw new Error('[Semantic Search] APP_KEYS environment variable is required for encryption');
  }
  return crypto.scryptSync(key, 'semantic-search-salt', 32);
};

const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedData: string): string => {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const maskApiKey = (key: string): string => {
  if (!key) return '';
  if (key.length < 8) {
    return '*'.repeat(key.length);
  }

  const prefixLength = 3;
  const suffixLength = 4;
  const fillerLength = Math.max(1, key.length - prefixLength - suffixLength);

  return key.slice(0, prefixLength) + '*'.repeat(fillerLength) + key.slice(-suffixLength);
};

export default ({ strapi }) => ({
  getPluginStore() {
    return strapi.store({
      environment: '',
      type: 'plugin',
      name: PLUGIN_ID,
    });
  },

  async getSettings(): Promise<ISettings> {
    const pluginStore = this.getPluginStore();
    let config = await pluginStore.get({ key: 'settings' });
    if (!config) {
      config = await this.createDefaultConfig();
    }
    return config as ISettings;
  },

  async getApiKey(): Promise<string | null> {
    const settings = await this.getSettings();
    if (settings.encryptedApiKey) {
      try {
        return decrypt(settings.encryptedApiKey);
      } catch (error) {
        strapi.log.error('[Semantic Search] Failed to decrypt API key:', error);
        return null;
      }
    }
    return null;
  },

  async createDefaultConfig(): Promise<ISettings> {
    const defaultConfig: ISettings = {
      encryptedApiKey: null,
      embeddingUrl: '',
      embeddingModel: '',
      autoGenerate: false,
      contentTypes: [],
      searchLimit: 10,
      searchThreshold: 0.3,
      searchLocale: 'en',
    };
    const pluginStore = this.getPluginStore();
    await pluginStore.set({ key: 'settings', value: defaultConfig });
    return defaultConfig;
  },

  async getApiSettingsForUI() {
    const settings = await this.getSettings();
    let maskedApiKey = '';

    if (settings.encryptedApiKey) {
      try {
        const decryptedKey = decrypt(settings.encryptedApiKey);
        maskedApiKey = maskApiKey(decryptedKey);
      } catch (error) {
        strapi.log.error('[Semantic Search] Failed to decrypt API key for UI:', error);
      }
    }

    return {
      apiKey: maskedApiKey,
      embeddingUrl: settings.embeddingUrl || '',
      embeddingModel: settings.embeddingModel || '',
    };
  },

  async setApiSettings(settings: {
    apiKey?: string;
    embeddingUrl?: string;
    embeddingModel?: string;
  }) {
    const pluginStore = this.getPluginStore();
    const currentSettings = await this.getSettings();

    // Only encrypt and update API key if a new value is provided
    let encryptedApiKey = currentSettings.encryptedApiKey;
    if (settings.apiKey !== undefined && settings.apiKey !== '') {
      encryptedApiKey = encrypt(settings.apiKey);
    }

    const updatedSettings: ISettings = {
      encryptedApiKey,
      embeddingUrl:
        settings.embeddingUrl !== undefined ? settings.embeddingUrl : currentSettings.embeddingUrl,
      embeddingModel:
        settings.embeddingModel !== undefined
          ? settings.embeddingModel
          : currentSettings.embeddingModel,
      autoGenerate: currentSettings.autoGenerate,
      contentTypes: currentSettings.contentTypes,
      searchLimit: currentSettings.searchLimit,
      searchThreshold: currentSettings.searchThreshold,
      searchLocale: currentSettings.searchLocale,
    };

    await pluginStore.set({ key: 'settings', value: updatedSettings });
    return this.getApiSettingsForUI();
  },

  async getPluginSettingsForUI() {
    const settings = await this.getSettings();
    return {
      autoGenerate: settings.autoGenerate,
      contentTypes: settings.contentTypes,
      searchLimit: settings.searchLimit,
      searchThreshold: settings.searchThreshold,
      searchLocale: settings.searchLocale,
    };
  },

  async setPluginSettings(settings: {
    autoGenerate?: boolean;
    contentTypes?: IContentTypeConfig[];
    searchLimit?: number;
    searchThreshold?: number;
    searchLocale?: string;
  }) {
    const pluginStore = this.getPluginStore();
    const currentSettings = await this.getSettings();

    const updatedSettings: ISettings = {
      encryptedApiKey: currentSettings.encryptedApiKey,
      embeddingUrl: currentSettings.embeddingUrl,
      embeddingModel: currentSettings.embeddingModel,
      autoGenerate: settings.autoGenerate ?? currentSettings.autoGenerate,
      contentTypes: settings.contentTypes ?? currentSettings.contentTypes,
      searchLimit: settings.searchLimit ?? currentSettings.searchLimit,
      searchThreshold: settings.searchThreshold ?? currentSettings.searchThreshold,
      searchLocale: settings.searchLocale ?? currentSettings.searchLocale,
    };

    await pluginStore.set({ key: 'settings', value: updatedSettings });
    return this.getPluginSettingsForUI();
  },

  async getSearchDefaults() {
    const settings = await this.getSettings();
    return {
      searchLimit: settings.searchLimit,
      searchThreshold: settings.searchThreshold,
      searchLocale: settings.searchLocale,
    };
  },
});
