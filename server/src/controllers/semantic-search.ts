import { PLUGIN_ID } from '../pluginId';
import { MAX_POPULATE_DEPTH } from '../services/semantic-search';

// Reads `depth` from the request body or query string. Returns undefined when
// absent, null when invalid.
const parseDepth = (ctx): number | undefined | null => {
  const raw = ctx.request.body?.depth ?? ctx.request.query?.depth;
  if (raw === undefined || raw === null || raw === '') return undefined;

  const depth = Number(raw);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_POPULATE_DEPTH) return null;
  return depth;
};

export default ({ strapi }) => ({
  async search(ctx) {
    const { query, contentType, limit, threshold, locale, domain, populate } = ctx.request.body;

    if (!query) {
      return ctx.badRequest('Query is required');
    }

    if (!contentType) {
      return ctx.badRequest('Content type is required');
    }

    const depth = parseDepth(ctx);
    if (depth === null) {
      return ctx.badRequest(`Depth must be an integer between 1 and ${MAX_POPULATE_DEPTH}`);
    }

    const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
    const contentTypes = await service.getContentTypes();

    if (!contentTypes[contentType]) {
      return ctx.badRequest(`Content type ${contentType} is not configured for semantic search`);
    }

    try {
      const defaults = await strapi.plugin(PLUGIN_ID).service('settings').getSearchDefaults();
      const results = await service.search(query, contentType, {
        limit: limit ?? defaults.searchLimit,
        threshold: threshold ?? defaults.searchThreshold,
        locale: locale ?? defaults.searchLocale,
        domain,
        populate,
        depth,
      });

      return { success: true, data: results };
    } catch (error) {
      strapi.log.error(`[Semantic Search] Search error: ${error}`);
      return ctx.internalServerError('Search failed');
    }
  },

  async multiSearch(ctx) {
    const {
      query,
      contentTypes: requestedTypes,
      limit,
      threshold,
      locale,
      domain,
      populate,
    } = ctx.request.body;

    if (!query) {
      return ctx.badRequest('Query is required');
    }

    const depth = parseDepth(ctx);
    if (depth === null) {
      return ctx.badRequest(`Depth must be an integer between 1 and ${MAX_POPULATE_DEPTH}`);
    }

    const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
    const contentTypes = await service.getContentTypes();
    const typesToSearch = requestedTypes || Object.keys(contentTypes);

    try {
      const defaults = await strapi.plugin(PLUGIN_ID).service('settings').getSearchDefaults();
      const results: Record<string, any> = {};

      for (const ct of typesToSearch) {
        if (!contentTypes[ct]) continue;
        results[ct] = await service.search(query, ct, {
          limit: limit ?? defaults.searchLimit,
          threshold: threshold ?? defaults.searchThreshold,
          locale: locale ?? defaults.searchLocale,
          domain,
          populate,
          depth,
        });
      }

      const allResults = Object.entries(results)
        .flatMap(([ct, data]: [string, any]) =>
          data.results.map((r: any) => ({ ...r, contentType: ct }))
        )
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit ?? defaults.searchLimit);

      return {
        success: true,
        data: {
          results: allResults,
          byContentType: results,
          metadata: { query, contentTypes: typesToSearch, totalResults: allResults.length },
        },
      };
    } catch (error) {
      strapi.log.error(`[Semantic Search] Multi-search error: ${error}`);
      return ctx.internalServerError('Search failed');
    }
  },

  async stats(ctx) {
    try {
      const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
      const stats = await service.getStats();
      return { success: true, data: stats };
    } catch (error) {
      strapi.log.error(`[Semantic Search] Stats error: ${error}`);
      return ctx.internalServerError('Failed to get statistics');
    }
  },

  async regenerate(ctx) {
    const { contentType, locale } = ctx.request.body;
    const entityLocale = locale || 'en';

    if (!contentType) {
      return ctx.badRequest('Content type is required');
    }

    const service = strapi.plugin(PLUGIN_ID).service('semantic-search');
    const contentTypes = await service.getContentTypes();

    const ctConfig = contentTypes[contentType];
    if (!ctConfig) {
      return ctx.badRequest(`Content type ${contentType} is not configured for semantic search`);
    }

    const { fields } = ctConfig;

    // Page through shallow rows (no populate), then populate one entity at a
    // time. Deep populate queries are heavy; loading entities in bulk with
    // populate holds large graphs in memory and monopolizes the database
    // connection, starving concurrent requests (e.g. the stats endpoint).
    const BATCH_SIZE = 100;

    setImmediate(async () => {
      try {
        const populate = service.resolvePopulate(contentType, ctConfig);
        const total = await strapi.documents(contentType as any).count({
          locale: entityLocale,
          status: 'published',
        });

        strapi.log.info(
          `[Semantic Search] Starting regeneration for ${contentType} (${total} entities)`
        );

        let processed = 0;
        let failed = 0;
        let start = 0;

        while (true) {
          const batch = await strapi.documents(contentType as any).findMany({
            locale: entityLocale,
            status: 'published',
            start,
            limit: BATCH_SIZE,
          });

          if (!batch || batch.length === 0) break;

          for (const { documentId } of batch as any[]) {
            try {
              const entity = await strapi.documents(contentType as any).findOne({
                documentId,
                locale: entityLocale,
                status: 'published',
                populate,
              });

              if (!entity) {
                strapi.log.warn(`[Semantic Search] Entity ${documentId} not found, skipping`);
                failed++;
                continue;
              }

              const result = await service.generateEmbeddingForEntity(contentType, entity, fields);

              if (!result) {
                strapi.log.warn(`[Semantic Search] No embedding generated for ${documentId}`);
                failed++;
                continue;
              }

              const saved = await service.saveEmbedding(
                contentType,
                documentId,
                entityLocale,
                result
              );

              if (!saved) {
                strapi.log.warn(`[Semantic Search] Failed to save embedding for ${documentId}`);
                failed++;
                continue;
              }

              processed++;
            } catch (error) {
              strapi.log.error(`[Semantic Search] Regenerate error for ${documentId}: ${error}`);
              failed++;
            }
          }

          strapi.log.info(
            `[Semantic Search] Regeneration progress for ${contentType}: ${processed + failed}/${total}`
          );

          if (batch.length < BATCH_SIZE) break;
          start += BATCH_SIZE;
        }

        strapi.log.info(
          `[Semantic Search] Regeneration complete for ${contentType}: ${processed} processed, ${failed} failed`
        );
      } catch (error) {
        strapi.log.error(`[Semantic Search] Regenerate error: ${error}`);
      }
    });

    return {
      success: true,
      data: {
        contentType,
        locale: entityLocale,
        status: 'queued',
        message: 'Embedding generation has been queued. Check stats endpoint for progress.',
      },
    };
  },

  async getApiSettings(ctx) {
    return strapi.plugin(PLUGIN_ID).service('settings').getApiSettingsForUI();
  },

  async updateApiSettings(ctx) {
    const { apiKey, embeddingUrl, embeddingModel } = ctx.request.body;

    // Only update API key if it's a new value (not a masked placeholder)
    const shouldUpdateApiKey = apiKey && !apiKey.includes('*');

    return strapi
      .plugin(PLUGIN_ID)
      .service('settings')
      .setApiSettings({
        apiKey: shouldUpdateApiKey ? apiKey : undefined,
        embeddingUrl,
        embeddingModel,
      });
  },

  async getPluginSettings(ctx) {
    return strapi.plugin(PLUGIN_ID).service('settings').getPluginSettingsForUI();
  },

  async updatePluginSettings(ctx) {
    const { autoGenerate, contentTypes, searchLimit, searchThreshold, searchLocale } =
      ctx.request.body;

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
});
