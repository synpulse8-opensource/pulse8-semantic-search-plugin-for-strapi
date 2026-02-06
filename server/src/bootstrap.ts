import type { Core } from '@strapi/strapi';
import { PLUGIN_ID } from './pluginId';

interface IContentTypeConfig {
  contentType: string;
  fields: string[];
  embeddingFields: string[];
  responseFields: string[];
}

interface ILifecycleEvent {
  model: {
    uid: string;
  };
  result?: {
    id: number;
    documentId: string;
    locale?: string;
    [key: string]: unknown;
  };
}

async function handleContentChange(strapi: Core.Strapi, event: ILifecycleEvent, action: string) {
  const { model, result } = event;
  const uid = model.uid;

  if (!result || !result.documentId) return;

  try {
    // Check if auto-generate is enabled
    const settings = await strapi.plugin(PLUGIN_ID).service('settings').getSettings();
    if (!settings.autoGenerate) return;

    // Check if this content type is configured
    const contentTypes = settings.contentTypes || [];
    const config = contentTypes.find((ct: IContentTypeConfig) => ct.contentType === uid);
    if (!config) return;

    const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
    const embeddingResult = await service.generateEmbeddingForEntity(uid, result, config.fields, config.embeddingFields || []);

    if (embeddingResult) {
      await service.saveEmbedding(uid, result.documentId, result.locale || 'en', embeddingResult);
      strapi.log.info(
        `[Semantic Search] Auto-generated embedding for ${uid}:${result.documentId} (${action})`
      );
    }
  } catch (error) {
    strapi.log.error(`[Semantic Search] Error in handleContentChange: ${error}`);
  }
}

async function handleContentDelete(strapi: Core.Strapi, event: ILifecycleEvent) {
  const { model, result } = event;
  const uid = model.uid;

  if (!result || !result.documentId) return;

  try {
    // Only delete if this content type is configured
    const settings = await strapi.plugin(PLUGIN_ID).service('settings').getSettings();
    const contentTypes = settings.contentTypes || [];
    const config = contentTypes.find((ct: IContentTypeConfig) => ct.contentType === uid);
    if (!config) return;

    const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
    await service.deleteEmbedding(uid, result.documentId, result.locale);
    strapi.log.info(`[Semantic Search] Deleted embedding for ${uid}:${result.documentId}`);
  } catch (error) {
    strapi.log.error(`[Semantic Search] Error in handleContentDelete: ${error}`);
  }
}

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.db.lifecycles.subscribe({
    async afterCreate(event) {
      await handleContentChange(strapi, event as ILifecycleEvent, 'create');
    },
    async afterUpdate(event) {
      await handleContentChange(strapi, event as ILifecycleEvent, 'update');
    },
    async afterDelete(event) {
      await handleContentDelete(strapi, event as ILifecycleEvent);
    },
  });
};

export default bootstrap;
