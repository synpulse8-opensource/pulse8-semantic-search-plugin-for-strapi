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

Head to the admin panel and use the UI to configure your embedding model connection details and the plugin settings. You can find the content type of the your content from the url, e.g. `http://localhost:1337/admin/content-manager/collection-types/api::article.article`. For more examples on configuration, check the [screenshots](./screenshots/) folder.

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
