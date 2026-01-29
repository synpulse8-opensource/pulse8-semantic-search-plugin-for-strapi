import { Box, Tabs } from '@strapi/design-system'
import { Content } from './Content'
import { Settings } from './Settings'
import { Stats } from './Stats'
import { useApiSettings } from '../hooks/useApiSettings';
import { usePluginSettings } from '../hooks/usePluginSettings';
import { useStats } from '../hooks/useStats';

export const PluginTabs = () => {
  const apiSettingsHook = useApiSettings();
  const pluginSettingsHook = usePluginSettings();
  const statsHook = useStats();

  return (
    <Tabs.Root defaultValue="collections">
      <Tabs.List>
        <Tabs.Trigger value="collections">Collections</Tabs.Trigger>
        <Tabs.Trigger value="stats">Stats</Tabs.Trigger>
        <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="collections">
        <Box color="neutral800" padding={4} background="neutral0">
          <Content pluginSettingsHook={pluginSettingsHook} />
        </Box>
      </Tabs.Content>
      <Tabs.Content value="stats">
        <Box color="neutral800" padding={4} background="neutral0">
          <Stats statsHook={statsHook} />
        </Box>
      </Tabs.Content>
      <Tabs.Content value="settings">
        <Box color="neutral800" padding={4} background="neutral0">
          <Settings apiSettingsHook={apiSettingsHook} />
        </Box>
      </Tabs.Content>
    </Tabs.Root>
  )
}
