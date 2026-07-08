import OpenAI from 'openai';
import { PLUGIN_ID } from '../pluginId';
import type { IContentTypeConfig } from './settings';

// Plugin content type UID for storing embeddings
const EMBEDDING_UID = `plugin::${PLUGIN_ID}.embedding`;

export interface IEmbeddingMetadata {
  generatedAt: string;
  textLength: number;
  model: string;
  dimensions: number;
}

export interface IEmbeddingResult {
  embedding: number[];
  metadata: IEmbeddingMetadata;
}

export interface IContentEntity {
  id: number;
  documentId: string;
  locale?: string;
  [key: string]: unknown;
}

export interface IEmbeddingRecord {
  id: number;
  contentDocumentId: string;
  contentType: string;
  locale: string;
  embedding: number[];
  embeddingMetadata: IEmbeddingMetadata;
}

export interface ISearchOptions {
  limit?: number;
  threshold?: number;
  locale?: string;
  domain?: string;
  populate?: string[];
  depth?: number;
}

// Maximum populate depth to keep generated populate queries bounded
export const MAX_POPULATE_DEPTH = 10;

// TODO: let user select fields to exclude from text extraction
// Fields to exclude from text extraction (never include in searchable text)
const EXCLUDED_FIELDS = new Set([
  'id',
  'documentId',
  'meet',
  'isExpert',
  'isActive',
  'isScheduleMeetEnable',
  'scheduleMeetingLink',
  'embedding',
  'embeddingMetadata',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
  '__component',
  // Media/file technical fields (noise when populating deeply)
  'url',
  'previewUrl',
  'formats',
  'hash',
  'ext',
  'mime',
  'provider',
  'provider_metadata',
]);

// Fields to exclude from search response entities
const EXCLUDED_ENTITY_FIELDS = new Set(['embedding', 'embeddingMetadata']);

export default ({ strapi }) => {
  let openaiClient: OpenAI | null = null;
  let cachedApiKey: string | null = null;
  let cachedBaseURL: string | undefined = undefined;
  let cachedModel: string | undefined = undefined;

  const getOpenAIClient = async (): Promise<OpenAI | null> => {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings');
    const apiKey = await settingsService.getApiKey();
    const settings = await settingsService.getSettings();
    const baseURL = settings.embeddingUrl || undefined;

    // Reset client if configuration changed
    if (openaiClient && (apiKey !== cachedApiKey || baseURL !== cachedBaseURL)) {
      strapi.log.info('[Semantic Search] Resetting client due to config change');
      openaiClient = null;
    }

    if (!openaiClient) {
      if (!apiKey) {
        strapi.log.warn('[Semantic Search] API key not configured in settings');
        return null;
      }
      cachedApiKey = apiKey;
      cachedBaseURL = baseURL;
      openaiClient = new OpenAI({ apiKey, baseURL });
    }
    cachedModel = settings.embeddingModel || undefined;

    return openaiClient;
  };

  const generateEmbedding = async (text: string): Promise<number[] | null> => {
    const client = await getOpenAIClient();
    if (!client) return null;

    if (!cachedModel) {
      strapi.log.warn('[Semantic Search] Embedding model not configured in settings');
      return null;
    }

    try {
      const cleanText = text
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);

      if (!cleanText) return null;

      strapi.log.info(
        `[Semantic Search] Calling embeddings API with model: ${cachedModel}, input length: ${cleanText.length}`
      );
      const response = await client.embeddings.create({
        model: cachedModel,
        input: cleanText,
      });

      return response.data[0].embedding;
    } catch (error) {
      strapi.log.error(`[Semantic Search] Embedding error: ${error}`);
      if (error instanceof Error) {
        strapi.log.error(`[Semantic Search] Error details: ${error.message}`);
      }
      return null;
    }
  };

  const collectText = (value: unknown, textParts: string[]): void => {
    if (!value) return;

    if (typeof value === 'string') {
      if (value.trim()) textParts.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        collectText(item, textParts);
      }
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (EXCLUDED_FIELDS.has(k)) continue;
        collectText(v, textParts);
      }
    }
  };

  const extractTextFromEntity = (entity: IContentEntity, fields: string[]): string => {
    const textParts: string[] = [];

    for (const field of fields) {
      collectText(entity[field], textParts);
    }

    return textParts.join(' ').trim();
  };

  const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  };

  const stripExcludedEntityFields = (entity: IContentEntity): IContentEntity => {
    const cleaned = { ...entity };
    for (const field of EXCLUDED_ENTITY_FIELDS) {
      delete cleaned[field];
    }
    return cleaned;
  };

  const buildPopulate = (populateFields: string[]): Record<string, boolean> | '*' => {
    if (populateFields.length === 0) return '*';
    return populateFields.reduce<Record<string, boolean>>((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});
  };

  // Build a nested populate query from the content type schema, `depth` levels deep.
  // depth=1 is equivalent to populate '*' (one level). Dynamic zones use the `on`
  // syntax so each component's own nested components get populated too, e.g.
  // populate[section][on][about-us.company-profile][populate][locations][populate]=*
  // Only components and dynamic zones are recursed into; relations and media are
  // populated one level only — relation graphs are cyclic and recursing into them
  // multiplies the loaded data per level (OOM risk on large datasets).
  //
  // `ancestors` stops components that (directly or indirectly) contain themselves
  // from being re-expanded, and `budget` caps the total populate node count —
  // without these, cyclic or heavily shared component schemas make the populate
  // tree grow exponentially with depth, blocking the event loop while it builds.
  const MAX_POPULATE_NODES = 5000;

  const buildDeepPopulateInner = (
    uid: string,
    depth: number,
    ancestors: Set<string>,
    budget: { remaining: number }
  ): Record<string, unknown> | '*' => {
    const cappedDepth = Math.min(Math.max(Math.floor(depth), 1), MAX_POPULATE_DEPTH);
    // Negated comparison so a non-numeric depth (NaN) also falls back to '*'
    if (!(cappedDepth > 1)) return '*';

    const model = strapi.getModel(uid);
    if (!model) return '*';

    const expandChild = (childUid: string): Record<string, unknown> | '*' => {
      if (ancestors.has(childUid) || budget.remaining <= 0) return '*';
      const childAncestors = new Set(ancestors);
      childAncestors.add(childUid);
      return buildDeepPopulateInner(childUid, cappedDepth - 1, childAncestors, budget);
    };

    const populate: Record<string, unknown> = {};
    for (const [name, attribute] of Object.entries(model.attributes as Record<string, any>)) {
      switch (attribute.type) {
        case 'component':
          budget.remaining--;
          populate[name] = { populate: expandChild(attribute.component) };
          break;
        case 'dynamiczone': {
          const on: Record<string, unknown> = {};
          for (const component of attribute.components ?? []) {
            budget.remaining--;
            on[component] = { populate: expandChild(component) };
          }
          populate[name] = { on };
          break;
        }
        case 'relation':
        case 'media':
          budget.remaining--;
          populate[name] = true;
          break;
        default:
          break;
      }
    }

    return Object.keys(populate).length > 0 ? populate : '*';
  };

  const buildDeepPopulate = (uid: string, depth: number): Record<string, unknown> | '*' => {
    const budget = { remaining: MAX_POPULATE_NODES };
    const result = buildDeepPopulateInner(uid, depth, new Set([uid]), budget);
    if (budget.remaining <= 0) {
      strapi.log.warn(
        `[Semantic Search] Populate tree for ${uid} at depth ${depth} exceeded ${MAX_POPULATE_NODES} nodes and was truncated. Consider lowering the populate depth.`
      );
    }
    return result;
  };

  // Priority: explicit populate list > explicit depth > configured depth > configured fields
  const resolvePopulate = (
    contentType: string,
    ctConfig: IContentTypeConfig,
    populate?: string[],
    depth?: number
  ): Record<string, unknown> | '*' => {
    if (populate !== undefined) return buildPopulate(populate);
    if (depth) return buildDeepPopulate(contentType, depth);
    if (ctConfig.populateDepth) return buildDeepPopulate(contentType, ctConfig.populateDepth);
    return buildPopulate(ctConfig.populateFields);
  };

  return {
    async search(query: string, contentType: string, options: ISearchOptions = {}) {
      const { limit = 10, threshold = 0.3, locale = 'en', domain, populate, depth } = options;

      const queryEmbedding = await generateEmbedding(query);
      if (!queryEmbedding) {
        return { results: [], metadata: { error: 'Failed to generate query embedding' } };
      }

      const contentTypes = await this.getContentTypes();
      const ctConfig = contentTypes[contentType];
      if (!ctConfig) {
        return {
          results: [],
          metadata: { error: `Content type ${contentType} is not configured for semantic search` },
        };
      }

      // Query embeddings from the plugin's embedding table
      const embeddingRecords = (await strapi.db.query(EMBEDDING_UID).findMany({
        where: {
          contentType,
          locale,
        },
      })) as IEmbeddingRecord[];

      // Calculate similarity scores
      const scoredEmbeddings = embeddingRecords
        .map((record) => {
          if (!record.embedding) return null;
          const similarity = cosineSimilarity(queryEmbedding, record.embedding);
          return { ...record, similarityScore: Math.round(similarity * 10000) / 10000 };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null && r.similarityScore >= threshold)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);

      // Fetch the actual content from the original content type
      const results: Array<IContentEntity & { similarityScore: number }> = [];
      for (const embeddingRecord of scoredEmbeddings) {
        try {
          const entities = await strapi.documents(contentType as any).findMany({
            locale,
            status: 'published',
            filters: { documentId: embeddingRecord.contentDocumentId },
            populate: resolvePopulate(contentType, ctConfig, populate, depth),
          });

          if (entities && entities.length > 0) {
            const entity = entities[0] as IContentEntity;
            // Apply domain filter if specified
            if (domain && entity.domain !== domain) continue;
            results.push({
              ...stripExcludedEntityFields(entity),
              similarityScore: embeddingRecord.similarityScore,
            });
          }
        } catch (error) {
          strapi.log.warn(
            `[Semantic Search] Failed to fetch entity ${embeddingRecord.contentDocumentId}: ${error}`
          );
        }
      }

      return {
        results,
        metadata: { query, contentType, totalResults: results.length, threshold },
      };
    },

    async generateEmbeddingForEntity(
      uid: string,
      entity: IContentEntity,
      fields: string[]
    ): Promise<IEmbeddingResult | null> {
      const text = extractTextFromEntity(entity, fields);
      if (!text) return null;

      const embedding = await generateEmbedding(text);
      if (!embedding) return null;

      return {
        embedding,
        metadata: {
          generatedAt: new Date().toISOString(),
          textLength: text.length,
          model: cachedModel || '',
          dimensions: embedding.length,
        },
      };
    },

    async saveEmbedding(
      contentType: string,
      documentId: string,
      locale: string,
      embeddingResult: IEmbeddingResult
    ): Promise<boolean> {
      try {
        // Check if an embedding record already exists
        const existing = await strapi.db.query(EMBEDDING_UID).findOne({
          where: {
            contentType,
            contentDocumentId: documentId,
            locale,
          },
        });

        if (existing) {
          // Update existing record
          await strapi.db.query(EMBEDDING_UID).update({
            where: { id: existing.id },
            data: {
              embedding: embeddingResult.embedding,
              embeddingMetadata: embeddingResult.metadata,
            },
          });
        } else {
          // Create new record
          await strapi.db.query(EMBEDDING_UID).create({
            data: {
              contentType,
              contentDocumentId: documentId,
              locale,
              embedding: embeddingResult.embedding,
              embeddingMetadata: embeddingResult.metadata,
            },
          });
        }

        return true;
      } catch (error) {
        strapi.log.error(`[Semantic Search] Failed to save embedding: ${error}`);
        return false;
      }
    },

    async deleteEmbedding(
      contentType: string,
      documentId: string,
      locale?: string
    ): Promise<boolean> {
      try {
        const where: Record<string, string> = { contentType, contentDocumentId: documentId };
        if (locale) where.locale = locale;

        await strapi.db.query(EMBEDDING_UID).deleteMany({ where });
        return true;
      } catch (error) {
        strapi.log.error(`[Semantic Search] Failed to delete embedding: ${error}`);
        return false;
      }
    },

    async deleteEmbeddingsByContentType(contentType: string): Promise<number> {
      try {
        const result = await strapi.db.query(EMBEDDING_UID).deleteMany({
          where: { contentType },
        });
        return result.count;
      } catch (error) {
        strapi.log.error(`[Semantic Search] Failed to delete embeddings: ${error}`);
        return 0;
      }
    },

    async getStats() {
      const stats: Record<string, { total: number; withEmbeddings: number; coverage: number }> = {};
      const contentTypes = await this.getContentTypes();

      for (const contentType of Object.keys(contentTypes)) {
        try {
          // Count total published entities in the user's content type
          const total = await strapi.documents(contentType as any).count({ status: 'published' });

          // Count embeddings in the plugin's embedding table for this content type
          const withEmbeddings = await strapi.db.query(EMBEDDING_UID).count({
            where: { contentType },
          });

          stats[contentType] = {
            total,
            withEmbeddings,
            coverage: total > 0 ? Math.round((withEmbeddings / total) * 100) : 0,
          };
        } catch (error) {
          strapi.log.error(`[Semantic Search] Stats error for ${contentType}: ${error}`);
        }
      }

      return stats;
    },

    async getContentTypes(): Promise<Record<string, IContentTypeConfig>> {
      const settings = await strapi.plugin(PLUGIN_ID).service('settings').getSettings();
      const contentTypesMap: Record<string, IContentTypeConfig> = {};
      for (const config of settings.contentTypes || []) {
        contentTypesMap[config.contentType] = {
          ...config,
          populateFields: config.populateFields || [],
        };
      }
      return contentTypesMap;
    },

    buildPopulate,
    buildDeepPopulate,
    resolvePopulate,
  };
};
