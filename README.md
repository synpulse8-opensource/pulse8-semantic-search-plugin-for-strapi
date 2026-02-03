# Strapi Semantic Search Plugin

AI-powered semantic search for Strapi CMS using embedding models. Search your content by meaning, not just keywords.

## Features

- **Semantic Search**: Find content based on meaning using AI embeddings
- **Multi-Provider Support**: Works with OpenAI, OpenRouter, and any OpenAI-compatible API
- **Admin Panel UI**: Configure everything through Strapi's admin interface
- **Auto-Generation**: Automatically generate embeddings when content is created or updated
- **Multi-Content Type**: Search across multiple content types simultaneously
- **Localization Support**: Generate embeddings per locale
- **Embedding Management**: View statistics, regenerate, or delete embeddings from the UI

## Notes

- Currently the plugin will **only** generate embeddings for content that is published.

## Installation

### From npm (Production)

```bash
# To be updated
npm install @your-org/strapi-semantic-search
# or
yarn add @your-org/strapi-semantic-search
```

### Local Development with yalc

For local plugin development, use [yalc](https://github.com/wclr/yalc) to link the plugin to your Strapi project.

#### 1. Install yalc globally

```bash
npm install -g yalc
```

#### 2. Publish the plugin

In the plugin directory:

```bash
npm install
npm run build
npm run watch:link
```

#### 3. Add to your Strapi project

In your Strapi project directory:

```bash
npm install openai
npx yalc add strapi-semantic-search && npx yalc link strapi-semantic-search && npx install
```

#### 4. Restart Strapi

```bash
npm run develop
```

#### 5. Update during development

When you make changes to the plugin:

```bash
# In the plugin directory
npm run build
yalc push

# In your Strapi project
npm run develop
```

## Configuration

Access the plugin settings at **Settings > Semantic Search** in the Strapi admin panel.

### Settings Tab

Configure your embedding API connection:

| Field                 | Description                     | Example                                                       |
| --------------------- | ------------------------------- | ------------------------------------------------------------- |
| **API Key**           | Your API key (stored encrypted) | `sk-...`                                                      |
| **Embedding API URL** | Base URL for the embeddings API | `https://api.openai.com/v1` or `https://openrouter.ai/api/v1` |
| **Embedding Model**   | The model to use for embeddings | `text-embedding-3-large` or `openai/text-embedding-3-small`   |

> **Note**: The API key is encrypted at rest using Strapi's APP_KEYS. The displayed key is masked for security.

### Collections Tab

Configure which content types to index for semantic search:

#### Content Types Configuration

Add content types to index:

| Field                 | Description                             | Example                       |
| --------------------- | --------------------------------------- | ----------------------------- |
| **Content Type**      | The Strapi content type UID             | `api::article.article`        |
| **Searchable Fields** | Comma-separated list of fields to embed | `title, description, content` |

#### Auto-Generate Embeddings

Enable the checkbox to automatically generate embeddings when content is created or updated.

#### Search Defaults

Set default values for search API calls:

| Field         | Description                         | Default |
| ------------- | ----------------------------------- | ------- |
| **Limit**     | Maximum number of results to return | `10`    |
| **Threshold** | Minimum similarity score (0-1)      | `0.3`   |
| **Locale**    | Default locale for search           | `en`    |

### Stats Tab

View embedding coverage statistics for each configured content type:

- **Total Entities**: Number of content entries
- **With Embeddings**: Entries that have embeddings generated
- **Coverage**: Percentage of entries with embeddings

Actions available:

- **Regenerate embeddings**: Re-generate embeddings for a content type or all types
- **Delete embeddings**: Remove embeddings for a content type or all types
- **Refresh stats**: Reload the statistics

## API Endpoints

All endpoints are available under `/api/semantic-search/`.

### Search Single Content Type

```bash
POST /api/semantic-search/search
Content-Type: application/json

{
  "query": "digital transformation in banking",
  "contentType": "api::article.article",
  "limit": 10,
  "threshold": 0.3,
  "locale": "en"
}
```

### Search Multiple Content Types

```bash
POST /api/semantic-search/multi-search
Content-Type: application/json

{
  "query": "financial services consulting",
  "contentTypes": ["api::article.article", "api::page.page"],
  "limit": 10,
  "threshold": 0.3,
  "locale": "en"
}
```

### Get Statistics

```bash
GET /api/semantic-search/stats
```

### Regenerate Embeddings

```bash
POST /api/semantic-search/regenerate
Content-Type: application/json

{
  "contentType": "api::article.article",
  "locale": "en"
}
```

> **Note**: Regeneration runs asynchronously. The endpoint returns immediately with a "queued" status. Check the stats endpoint or admin panel to monitor progress.

### Delete Embeddings

```bash
POST /api/semantic-search/delete
Content-Type: application/json

{
  "contentType": "api::article.article"
}
```

## Response Format

### Search Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": 1,
        "documentId": "abc123",
        "title": "Digital Banking Transformation",
        "similarityScore": 0.8945
      }
    ],
    "metadata": {
      "query": "digital transformation",
      "contentType": "api::article.article",
      "totalResults": 5,
      "threshold": 0.3
    }
  }
}
```

### Multi-Search Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": 1,
        "documentId": "abc123",
        "title": "Example Article",
        "similarityScore": 0.89,
        "contentType": "api::article.article"
      }
    ],
    "byContentType": {
      "api::article.article": { "results": [...] },
      "api::page.page": { "results": [...] }
    },
    "metadata": {
      "query": "search query",
      "contentTypes": ["api::article.article", "api::page.page"],
      "totalResults": 10
    }
  }
}
```

### Stats Response

```json
{
  "success": true,
  "data": {
    "api::article.article": {
      "total": 50,
      "withEmbeddings": 45,
      "coverage": 90
    }
  }
}
```

## Similarity Scores

The similarity score (0-1) indicates how semantically similar the content is to the query:

| Score Range | Relevance         | Description           |
| ----------- | ----------------- | --------------------- |
| 0.85 - 1.0  | Highly relevant   | Direct topic match    |
| 0.75 - 0.85 | Relevant          | Related concepts      |
| 0.65 - 0.75 | Somewhat relevant | Tangential connection |
| Below 0.65  | Low relevance     | Weak or no connection |

Adjust the `threshold` parameter based on your use case. Lower values return more results but may include less relevant content.

## Troubleshooting

### Embeddings Not Generating

1. **Check API configuration**: Ensure API key, URL, and model are configured in Settings tab
2. **Check Strapi logs**: Look for `[Semantic Search]` messages
3. **Verify content is published**: Drafts don't get embeddings
4. **Check auto-generate is enabled**: Enable in Collections tab

### Search Returns No Results

1. **Verify embeddings exist**: Check Stats tab for coverage
2. **Lower the threshold**: Try `0.2` or `0.1` for broader results
3. **Check content type is configured**: Ensure it's in the Collections tab
4. **Regenerate embeddings**: Use Stats tab to regenerate

### API Key Errors (401)

1. **Verify API key is correct**: Re-enter the key in Settings tab
2. **Check API URL**: Ensure it matches your provider (don't include `/embeddings` suffix)
3. **Check model name**: Ensure the model is available from your provider

### Plugin Not Loading

1. **Check plugin is enabled** in `config/plugins.ts`
2. **Rebuild the plugin**: `npm run build` in plugin directory
3. **Clear Strapi cache**: Delete `.cache` and `build` folders
4. **Restart Strapi**: `npm run develop`

## Contributing

Thank you for your interest in contributing to the semantic search plugin! This plugin is created and maintained by [Synpulse](https://www.synpulse.com/en).
If you would like to contribute to the project, please create an issue and submit a pull request. Our maintainers
will review your pull request as soon as possible.

## License

See the [LICENSE](./LICENSE) file for licensing information.
