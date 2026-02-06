# Strapi Semantic Search Plugin

AI-powered semantic search for Strapi CMS using embedding models. Search your content by meaning, not just keywords.

## Table of contents

- [Quick start](#quick-start)
- [Description](#description)
- [Configuration](#configuration)
- [API endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)
- [Local development](#local-development)
- [Contributing](#contributing)
- [License](#license)

## Quick start

To add semantic search to your local Strapi instance, simply install the npm package.

```bash
npm install strapi-semantic-search
# or
yarn add strapi-semantic-search
```

Once installed, navigate to the semantic search tab in the admin panel and configure the content to be serach.

For strapi cloud, we are working on getting this plugin into Strapi market, stay tuned.

## Description

The main goal of this plugin is to allow users to easily setup and use semantic search with any embedding model that they want.
The plugin provide the following features:

- **Semantic Search**: Find content based on meaning using AI embeddings
- **Multi-Provider Support**: Works with any OpenAI-compatible API
- **Auto-Generation**: Automatically generate embeddings when content is created or updated
- **Multi-Content Type**: Search across multiple content types simultaneously
- **Embedding Management**: View statistics, regenerate, or delete embeddings from the UI
- **Note**: Currently the plugin will **only** generate embeddings for content that is published.

## Configuration

Head to the admin panel and use the UI to configure your embedding model connection details and the plugin settings. For more examples on configuration, check the [screenshots](./screenshots/) folder.

### Finding Content Types and Fields

- **Content type UID**: You can find this from the URL in the admin panel, e.g. `http://localhost:1337/admin/content-manager/collection-types/api::article.article` means the UID is `api::article.article`.
- **Available fields**: To see all available fields for your content types, you can use the Content-Type Builder API:
  ```
  GET /api/content-type-builder/content-types
  ```
  This returns the full schema for all content types, including their attributes (fields) and types. You can also view field names in the Content-Type Builder section of the Strapi admin panel.

### Field Configuration

Each content type has three field settings that control how text is extracted for embeddings and what data is returned in search results:

| Setting               | Purpose                                                                                                                                                                                                                                                  | Example                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Searchable fields** | Top-level fields the plugin reads to build embedding text. These are the field names on your content type.                                                                                                                                               | `title, description, blocks` |
| **Embedding fields**  | Sub-fields within nested objects, components, or dynamic zones. When a searchable field contains objects or arrays of objects, this controls which keys inside those objects are used for text extraction. Leave empty to include all string sub-fields. | `body, caption`              |
| **Response fields**   | Fields returned in the search API response. Leave empty to return all fields. `id` and `documentId` are always included.                                                                                                                                 | `title, slug, publishedAt`   |

**Example**: Suppose you have an `Article` content type with fields `title` (string), `slug` (string), `blocks` (dynamic zone with components that have `body` and `caption` sub-fields), and `publishedAt` (datetime).

- **Searchable fields** = `title, blocks` -- the plugin reads the `title` string and iterates over the `blocks` array to extract text.
- **Embedding fields** = `body` -- when processing each object in `blocks`, only the `body` sub-field is used (ignoring `__component`, `caption`, `id`, etc.). If left empty, all string sub-fields would be included.
- **Response fields** = `title, slug, publishedAt` -- the search API only returns these fields (plus `id` and `documentId`). If left empty, all fields except internal embedding data are returned.

### Similarity Scores

When searching you can configure the similarity score threshold which is a number 0-1 that indicates how relevant the content is to the query. Lower values return more results but may include less relevant content. In practice, we found that for searching in longer pieces of text 0.25 - 0.3 indicates that the article is relevant.

## API Endpoints

All endpoints are available under `/api/semantic-search/`. But the ones you will have to use the most are the following two. See [this](/server/src/documentation/index.ts) for the full documentation.

### Search Single Content Type

```bash
POST /api/strapi-semantic-search/search
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
POST /api/strapi-semantic-search/multi-search
Content-Type: application/json

{
  "query": "financial services consulting",
  "contentTypes": ["api::article.article", "api::page.page"],
  "limit": 10,
  "threshold": 0.3,
  "locale": "en"
}
```

## Troubleshooting

Check the console logs in your Strapi instance with the `[Semantic Search]` prefix. Common issues include

- Misconfigured API settings
- Searching for unpublished content
- Embeddings have not been generated yet
- Threshold is set too high

## Local Development

For local plugin development, view [this guide](https://docs.strapi.io/cms/plugins-development/create-a-plugin) on how to link a local plugin to a local Strapi instance with yalc. Essentially

```sh
# In the plugin directory
npm install
npm run build
npm run watch:link
```

```sh
# In the Strapi instance
npm install openai
npx yalc add strapi-semantic-search && npx yalc link strapi-semantic-search && npx install
npm run develop
```

## Contributing

Thank you for your interest in contributing to the semantic search plugin! This plugin is created and maintained by [Synpulse](https://www.synpulse.com/en). If you would like to contribute to the project, please create an issue and submit a pull request. Our maintainers will review your pull request as soon as possible.

## License

See the [LICENSE](./LICENSE) file for licensing information.
