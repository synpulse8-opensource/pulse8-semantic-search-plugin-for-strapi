import { useFetchClient } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../pluginId';
import {
  BackButton,
  Layouts,
  Page,
  private_AutoReloadOverlayBlockerProvider as AutoReloadOverlayBlockerProvider,
} from '@strapi/strapi/admin';
import { PluginTabs } from '../components/PluginTabs'

const HomePage = () => {
  const { post } = useFetchClient();

  const handleRegenerate = async () => {
    try {
      const response = await post(`/${PLUGIN_ID}/regenerate`, {
        contentType: 'api::insight.insight', // placeholder content type
        locale: 'en'
      });
      console.log('Regenerate embeddings response:', response.data);
    } catch (error) {
      console.error('Error calling regenerate embeddings:', error);
    }
  };

  return (
    <AutoReloadOverlayBlockerProvider>
      <Page.Main>
        <Layouts.Header
          title="Semantic Search"
          subtitle="Search for your content using contextual meaning with any OpenAI compatible API"
          navigationAction={<BackButton disabled={false} />}
        />
        <Layouts.Content>
          <PluginTabs />
        </Layouts.Content>
      </Page.Main>
    </AutoReloadOverlayBlockerProvider>
  );
};

export { HomePage };
