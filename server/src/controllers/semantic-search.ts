import { PLUGIN_ID } from '../pluginId';

export default ({ strapi }) => ({
    async search(ctx) {
      const { query, contentType, limit, threshold, locale, domain } = ctx.request.body
  
      if (!query) {
        return ctx.badRequest('Query is required')
      }
  
      if (!contentType) {
        return ctx.badRequest('Content type is required')
      }

      const service = strapi.plugin(PLUGIN_ID).service('semantic-search')
      const contentTypes = await service.getContentTypes()
  
      if (!contentTypes[contentType]) {
        return ctx.badRequest(`Content type ${contentType} is not configured for semantic search`)
      }
  
      try {
        const defaults = await strapi.plugin(PLUGIN_ID).service('settings').getSearchDefaults()
        const results = await service.search(query, contentType, {
          limit: limit ?? defaults.searchLimit,
          threshold: threshold ?? defaults.searchThreshold,
          locale: locale ?? defaults.searchLocale,
          domain,
        })
  
        return { success: true, data: results }
      } catch (error) {
        strapi.log.error(`[Semantic Search] Search error: ${error}`)
        return ctx.internalServerError('Search failed')
      }
    },
  
    async multiSearch(ctx) {
      const { query, contentTypes: requestedTypes, limit, threshold, locale, domain } = ctx.request.body
  
      if (!query) {
        return ctx.badRequest('Query is required')
      }
  
      const service = strapi.plugin(PLUGIN_ID).service('semantic-search')
      const contentTypes = await service.getContentTypes()
      const typesToSearch = requestedTypes || Object.keys(contentTypes)
  
      try {
        const defaults = await strapi.plugin(PLUGIN_ID).service('settings').getSearchDefaults()
        const results: Record<string, any> = {}
  
        for (const ct of typesToSearch) {
          if (!contentTypes[ct]) continue
          results[ct] = await service.search(query, ct, {
            limit: limit ?? defaults.searchLimit,
            threshold: threshold ?? defaults.searchThreshold,
            locale: locale ?? defaults.searchLocale,
            domain,
          })
        }
  
        const allResults = Object.entries(results)
          .flatMap(([ct, data]: [string, any]) => data.results.map((r: any) => ({ ...r, contentType: ct })))
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, limit ?? defaults.searchLimit)
  
        return {
          success: true,
          data: {
            results: allResults,
            byContentType: results,
            metadata: { query, contentTypes: typesToSearch, totalResults: allResults.length },
          },
        }
      } catch (error) {
        strapi.log.error(`[Semantic Search] Multi-search error: ${error}`)
        return ctx.internalServerError('Search failed')
      }
    },
  
    async stats(ctx) {
      try {
        const service = strapi.plugin(PLUGIN_ID).service('semantic-search')
        const stats = await service.getStats()
        return { success: true, data: stats }
      } catch (error) {
        strapi.log.error(`[Semantic Search] Stats error: ${error}`)
        return ctx.internalServerError('Failed to get statistics')
      }
    },
  
    async regenerate(ctx) {
      const { contentType, locale } = ctx.request.body
      const entityLocale = locale || 'en'

      if (!contentType) {
        return ctx.badRequest('Content type is required')
      }

      const service = strapi.plugin(PLUGIN_ID).service('semantic-search')
      const contentTypes = await service.getContentTypes()

      if (!contentTypes[contentType]) {
        return ctx.badRequest(`Content type ${contentType} is not configured for semantic search`)
      }

      const fields = contentTypes[contentType]

      setImmediate(async () => {
        try {
          const entities = await strapi.documents(contentType as any).findMany({
            locale: entityLocale,
            status: 'published',
            populate: '*',
          })

          strapi.log.info(`[Semantic Search] Starting regeneration for ${contentType} (${entities.length} entities)`)

          let processed = 0
          let failed = 0

          for (const entity of entities as any[]) {
            try {
              const result = await service.generateEmbeddingForEntity(contentType, entity, fields)

              if (!result) {
                strapi.log.warn(`[Semantic Search] No embedding generated for ${entity.documentId}`)
                failed++
                continue
              }

              const saved = await service.saveEmbedding(
                contentType,
                entity.documentId,
                entityLocale,
                result
              )

              if (!saved) {
                strapi.log.warn(`[Semantic Search] Failed to save embedding for ${entity.documentId}`)
                failed++
                continue
              }

              processed++
            } catch (error) {
              strapi.log.error(`[Semantic Search] Regenerate error for ${entity.id}: ${error}`)
              failed++
            }
          }

          strapi.log.info(`[Semantic Search] Regeneration complete for ${contentType}: ${processed} processed, ${failed} failed`)
        } catch (error) {
          strapi.log.error(`[Semantic Search] Regenerate error: ${error}`)
        }
      })

      return {
        success: true,
        data: {
          contentType,
          locale: entityLocale,
          status: 'queued',
          message: 'Embedding generation has been queued. Check stats endpoint for progress.',
        },
      }
    },

    async getApiSettings(ctx) {
      return strapi.plugin(PLUGIN_ID).service('settings').getApiSettingsForUI();
    },

    async updateApiSettings(ctx) {
      const { apiKey, embeddingUrl, embeddingModel } = ctx.request.body;
      
      // Only update API key if it's a new value (not a masked placeholder)
      const shouldUpdateApiKey = apiKey && !apiKey.includes('*');
      
      return strapi.plugin(PLUGIN_ID).service('settings').setApiSettings({
        apiKey: shouldUpdateApiKey ? apiKey : undefined,
        embeddingUrl,
        embeddingModel,
      });
    },

    async getPluginSettings(ctx) {
      return strapi.plugin(PLUGIN_ID).service('settings').getPluginSettingsForUI();
    },

    async updatePluginSettings(ctx) {
      const { autoGenerate, contentTypes, searchLimit, searchThreshold, searchLocale } = ctx.request.body;
      
      return strapi.plugin(PLUGIN_ID).service('settings').setPluginSettings({
        autoGenerate,
        contentTypes,
        searchLimit,
        searchThreshold,
        searchLocale,
      });
    },

    async deleteEmbeddings(ctx) {
      const { contentType } = ctx.request.body;

      if (!contentType) {
        return ctx.badRequest('Content type is required');
      }

      try {
        const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
        const deleted = await service.deleteEmbeddingsByContentType(contentType);

        return {
          success: true,
          data: { contentType, deleted },
        };
      } catch (error) {
        strapi.log.error(`[Semantic Search] Delete error: ${error}`);
        return ctx.internalServerError('Failed to delete embeddings');
      }
    },
  })
  