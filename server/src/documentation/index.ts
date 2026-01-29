/**
 * Semantic Search Plugin - OpenAPI Documentation
 * This module exports the API documentation for the semantic-search plugin
 */

export const paths = {
    '/semantic-search/stats': {
      get: {
        tags: ['Semantic Search'],
        summary: 'Get embedding statistics',
        description: 'Returns statistics about embedding coverage for all configured content types',
        operationId: 'getSemanticSearchStats',
        responses: {
          200: {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer', description: 'Total published items' },
                          withEmbeddings: { type: 'integer', description: 'Items with embeddings' },
                          coverage: { type: 'integer', description: 'Percentage coverage' },
                        },
                      },
                    },
                  },
                },
                example: {
                  success: true,
                  data: {
                    'api::insight.insight': { total: 278, withEmbeddings: 278, coverage: 100 },
                    'api::expert.expert': { total: 184, withEmbeddings: 184, coverage: 100 },
                  },
                },
              },
            },
          },
          500: { description: 'Internal Server Error' },
        },
        security: [],
      },
    },
    '/semantic-search/search': {
      post: {
        tags: ['Semantic Search'],
        summary: 'Search content semantically',
        description: 'Performs semantic search on a specific content type using OpenAI embeddings',
        operationId: 'semanticSearch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query', 'contentType'],
                properties: {
                  query: { type: 'string', description: 'Search query text' },
                  contentType: { type: 'string', description: 'Content type UID (e.g., api::insight.insight)' },
                  limit: { type: 'integer', default: 10, description: 'Maximum results to return' },
                  threshold: { type: 'number', default: 0.3, description: 'Minimum similarity score (0-1)' },
                  locale: { type: 'string', default: 'en', description: 'Content locale' },
                  domain: { type: 'string', description: 'Optional domain filter' },
                },
              },
              example: {
                query: 'banking digital transformation',
                contentType: 'api::insight.insight',
                limit: 5,
                threshold: 0.3,
                locale: 'en',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successful search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        results: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer' },
                              documentId: { type: 'string' },
                              title: { type: 'string' },
                              similarityScore: { type: 'number' },
                            },
                          },
                        },
                        metadata: {
                          type: 'object',
                          properties: {
                            query: { type: 'string' },
                            contentType: { type: 'string' },
                            totalResults: { type: 'integer' },
                            threshold: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Bad Request - Missing query or contentType' },
          500: { description: 'Internal Server Error' },
        },
        security: [],
      },
    },
    '/semantic-search/multi-search': {
      post: {
        tags: ['Semantic Search'],
        summary: 'Search across multiple content types',
        description: 'Performs semantic search across multiple content types and returns combined results',
        operationId: 'semanticMultiSearch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', description: 'Search query text' },
                  contentTypes: { type: 'array', items: { type: 'string' }, description: 'Optional list of content types to search (defaults to all)' },
                  limit: { type: 'integer', default: 10, description: 'Maximum results per content type' },
                  threshold: { type: 'number', default: 0.3, description: 'Minimum similarity score' },
                  locale: { type: 'string', default: 'en', description: 'Content locale' },
                  domain: { type: 'string', description: 'Optional domain filter' },
                },
              },
              example: {
                query: 'cloud computing',
                limit: 3,
                threshold: 0.3,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successful multi-search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        results: { type: 'array', description: 'Combined results sorted by score' },
                        byContentType: { type: 'object', description: 'Results grouped by content type' },
                        metadata: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Bad Request' },
          500: { description: 'Internal Server Error' },
        },
        security: [],
      },
    },
    '/semantic-search/regenerate': {
      post: {
        tags: ['Semantic Search'],
        summary: 'Regenerate embeddings',
        description: 'Regenerates OpenAI embeddings for all published items of a specific content type',
        operationId: 'regenerateEmbeddings',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['contentType'],
                properties: {
                  contentType: { type: 'string', description: 'Content type UID to regenerate' },
                  locale: { type: 'string', default: 'en', description: 'Locale to regenerate' },
                },
              },
              example: {
                contentType: 'api::insight.insight',
                locale: 'en',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Regeneration completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        contentType: { type: 'string' },
                        total: { type: 'integer' },
                        processed: { type: 'integer' },
                        failed: { type: 'integer' },
                      },
                    },
                  },
                },
                example: {
                  success: true,
                  data: {
                    contentType: 'api::expert.expert',
                    total: 184,
                    processed: 184,
                    failed: 0,
                  },
                },
              },
            },
          },
          400: { description: 'Bad Request - Missing or invalid contentType' },
          500: { description: 'Internal Server Error' },
        },
        security: [],
      },
    },
  }
  
  export const tags = [
    {
      name: 'Semantic Search',
      description: 'Semantic search APIs using OpenAI embeddings for intelligent content discovery',
    },
  ]
  
  export default { paths, tags }
  