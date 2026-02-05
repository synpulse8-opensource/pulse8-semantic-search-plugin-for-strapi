/**
 * Application methods
 */
import bootstrap from './bootstrap';
import destroy from './destroy';
import register from './register';

/**
 * Plugin server methods
 */
import config from './config';
import contentTypes from './content-types';
import controllers from './controllers';
import middlewares from './middlewares';
import policies from './policies';
import routes from './routes';
import services from './services';

/**
 * Documentation for OpenAPI integration
 * Included in default export so bundler includes it
 */
import documentation from './documentation';

// Named export for documentation
export { documentation };

// Default export for Strapi plugin (includes documentation so bundler doesn't tree-shake it)
export default {
  register,
  bootstrap,
  destroy,
  config,
  controllers,
  routes,
  services,
  contentTypes,
  policies,
  middlewares,
  documentation,
};
