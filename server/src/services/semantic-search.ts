import OpenAI from 'openai'
import { PLUGIN_ID } from '../pluginId'

// Plugin content type UID for storing embeddings
const EMBEDDING_UID = `plugin::${PLUGIN_ID}.embedding`

export interface IEmbeddingMetadata {
  generatedAt: string
  textLength: number
  model: string
  dimensions: number
}

export interface IEmbeddingResult {
  embedding: number[]
  metadata: IEmbeddingMetadata
}

export interface IContentEntity {
  id: number
  documentId: string
  locale?: string
  [key: string]: unknown
}

export interface IEmbeddingRecord {
  id: number
  contentDocumentId: string
  contentType: string
  locale: string
  embedding: number[]
  embeddingMetadata: IEmbeddingMetadata
}

export interface ISearchOptions {
  limit?: number
  threshold?: number
  locale?: string
  domain?: string
}

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
  '__component'
])

export default ({ strapi }) => {
  let openaiClient: OpenAI | null = null
  let cachedApiKey: string | null = null
  let cachedBaseURL: string | undefined = undefined
  let cachedModel: string | undefined = undefined

  const getOpenAIClient = async (): Promise<OpenAI | null> => {
    const settingsService = strapi.plugin(PLUGIN_ID).service('settings')
    const apiKey = await settingsService.getApiKey()
    const settings = await settingsService.getSettings()
    const baseURL = settings.embeddingUrl || undefined

    // Reset client if configuration changed
    if (openaiClient && (apiKey !== cachedApiKey || baseURL !== cachedBaseURL)) {
      strapi.log.info('[Semantic Search] Resetting client due to config change')
      openaiClient = null
    }

    if (!openaiClient) {
      if (!apiKey) {
        strapi.log.warn('[Semantic Search] API key not configured in settings')
        return null
      }
      cachedApiKey = apiKey
      cachedBaseURL = baseURL
      openaiClient = new OpenAI({ apiKey, baseURL })
    }
    cachedModel = settings.embeddingModel || undefined

    return openaiClient
  }

  const generateEmbedding = async (text: string): Promise<number[] | null> => {
    const client = await getOpenAIClient()
    if (!client) return null

    if (!cachedModel) {
      strapi.log.warn('[Semantic Search] Embedding model not configured in settings')
      return null
    }

    try {
      const cleanText = text
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)

      if (!cleanText) return null

      strapi.log.info(`[Semantic Search] Calling embeddings API with model: ${cachedModel}, input length: ${cleanText.length}`)
      const response = await client.embeddings.create({
        model: cachedModel,
        input: cleanText,
      })

      return response.data[0].embedding
    } catch (error) {
      strapi.log.error(`[Semantic Search] Embedding error: ${error}`)
      if (error instanceof Error) {
        strapi.log.error(`[Semantic Search] Error details: ${error.message}`)
      }
      return null
    }
  }

  const extractTextFromEntity = (entity: IContentEntity, fields: string[]): string => {
    const textParts: string[] = []

    for (const field of fields) {
      const value = entity[field]
      if (!value) continue

      if (typeof value === 'string') {
        textParts.push(value)
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const obj = item as Record<string, unknown>
            for (const k of Object.keys(obj)) {
              if (EXCLUDED_FIELDS.has(k)) continue
              const v = obj[k]
              if (typeof v === 'string' && v.trim()) textParts.push(v)
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>
        // Include all string properties except excluded fields
        for (const k of Object.keys(obj)) {
          if (EXCLUDED_FIELDS.has(k)) continue
          const v = obj[k]
          if (typeof v === 'string' && v.trim()) textParts.push(v)
        }
      }
    }

    return textParts.join(' ').trim()
  }

  const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }

  return {
    async search(query: string, contentType: string, options: ISearchOptions = {}) {
      const { limit = 10, threshold = 0.3, locale = 'en', domain } = options

      const queryEmbedding = await generateEmbedding(query)
      if (!queryEmbedding) {
        return { results: [], metadata: { error: 'Failed to generate query embedding' } }
      }

      const contentTypes = await this.getContentTypes()
      if (!contentTypes[contentType]) {
        return { results: [], metadata: { error: `Content type ${contentType} is not configured for semantic search` } }
      }

      // Query embeddings from the plugin's embedding table
      const embeddingRecords = await strapi.db.query(EMBEDDING_UID).findMany({
        where: {
          contentType,
          locale,
        },
      }) as IEmbeddingRecord[]

      // Calculate similarity scores
      const scoredEmbeddings = embeddingRecords
        .map((record) => {
          if (!record.embedding) return null
          const similarity = cosineSimilarity(queryEmbedding, record.embedding)
          return { ...record, similarityScore: Math.round(similarity * 10000) / 10000 }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null && r.similarityScore >= threshold)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit)

      // Fetch the actual content from the original content type
      const results: Array<IContentEntity & { similarityScore: number }> = []
      for (const embeddingRecord of scoredEmbeddings) {
        try {
          const entities = await strapi.documents(contentType as any).findMany({
            locale,
            status: 'published',
            filters: { documentId: embeddingRecord.contentDocumentId },
            populate: '*',
          })
          
          if (entities && entities.length > 0) {
            const entity = entities[0] as IContentEntity
            // Apply domain filter if specified
            if (domain && entity.domain !== domain) continue
            results.push({ ...entity, similarityScore: embeddingRecord.similarityScore })
          }
        } catch (error) {
          strapi.log.warn(`[Semantic Search] Failed to fetch entity ${embeddingRecord.contentDocumentId}: ${error}`)
        }
      }

      return {
        results,
        metadata: { query, contentType, totalResults: results.length, threshold },
      }
    },

    async generateEmbeddingForEntity(uid: string, entity: IContentEntity, fields: string[]): Promise<IEmbeddingResult | null> {
      const text = extractTextFromEntity(entity, fields)
      if (!text) return null

      const embedding = await generateEmbedding(text)
      if (!embedding) return null

      return {
        embedding,
        metadata: {
          generatedAt: new Date().toISOString(),
          textLength: text.length,
          model: cachedModel || '',
          dimensions: embedding.length,
        },
      }
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
        })

        if (existing) {
          // Update existing record
          await strapi.db.query(EMBEDDING_UID).update({
            where: { id: existing.id },
            data: {
              embedding: embeddingResult.embedding,
              embeddingMetadata: embeddingResult.metadata,
            },
          })
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
          })
        }

        return true
      } catch (error) {
        strapi.log.error(`[Semantic Search] Failed to save embedding: ${error}`)
        return false
      }
    },

    async deleteEmbedding(
      contentType: string,
      documentId: string,
      locale?: string
    ): Promise<boolean> {
      try {
        const where: Record<string, string> = { contentType, contentDocumentId: documentId }
        if (locale) where.locale = locale

        await strapi.db.query(EMBEDDING_UID).deleteMany({ where })
        return true
      } catch (error) {
        strapi.log.error(`[Semantic Search] Failed to delete embedding: ${error}`)
        return false
      }
    },

    async deleteEmbeddingsByContentType(contentType: string): Promise<number> {
      try {
        const result = await strapi.db.query(EMBEDDING_UID).deleteMany({
          where: { contentType },
        })
        return result.count
      } catch (error) {
        strapi.log.error(`[Semantic Search] Failed to delete embeddings: ${error}`)
        return 0
      }
    },

    async getStats() {
      const stats: Record<string, { total: number; withEmbeddings: number; coverage: number }> = {}
      const contentTypes = await this.getContentTypes();

      for (const contentType of Object.keys(contentTypes)) {
        try {
          // Count total published entities in the user's content type
          const total = await strapi.documents(contentType as any).count({ status: 'published' })
          
          // Count embeddings in the plugin's embedding table for this content type
          const withEmbeddings = await strapi.db.query(EMBEDDING_UID).count({
            where: { contentType },
          })
          
          stats[contentType] = {
            total,
            withEmbeddings,
            coverage: total > 0 ? Math.round((withEmbeddings / total) * 100) : 0,
          }
        } catch (error) {
          strapi.log.error(`[Semantic Search] Stats error for ${contentType}: ${error}`)
        }
      }

      return stats
    },

    async getContentTypes() {
      const settings = await strapi.plugin(PLUGIN_ID).service('settings').getSettings();
      const contentTypesMap = {};
      for (const config of settings.contentTypes || []) {
        contentTypesMap[config.contentType] = config.fields;
      }
      return contentTypesMap;
    },
  }
}
