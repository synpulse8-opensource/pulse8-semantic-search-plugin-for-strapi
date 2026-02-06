export default () => ({
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/search',
      handler: 'semantic-search.search',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/multi-search',
      handler: 'semantic-search.multiSearch',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/stats',
      handler: 'semantic-search.stats',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/regenerate',
      handler: 'semantic-search.regenerate',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/delete',
      handler: 'semantic-search.deleteEmbeddings',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/api-settings',
      handler: 'semantic-search.getApiSettings',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/api-settings',
      handler: 'semantic-search.updateApiSettings',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/plugin-settings',
      handler: 'semantic-search.getPluginSettings',
      config: {
        auth: false,
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/plugin-settings',
      handler: 'semantic-search.updatePluginSettings',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
});
