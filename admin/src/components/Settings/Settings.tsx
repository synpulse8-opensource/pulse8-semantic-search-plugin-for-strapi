import React from "react";
import { Box, Button, Field, Flex, Grid } from "@strapi/design-system"
import { useApiSettings } from "../../hooks/useApiSettings"

interface ISettingsProps {
  apiSettingsHook: ReturnType<typeof useApiSettings>
}

export const Settings: React.FC<ISettingsProps> = ({ apiSettingsHook }) => {
  const { apiKey, setApiKey, embeddingUrl, setEmbeddingUrl, embeddingModel, setEmbeddingModel, saveSettings, isLoading, isDirty } = apiSettingsHook;

  return (
    <Box padding={5}>
      <Grid.Root gap={{ initial: 4 }}>
        <Grid.Item col={6}>
          <Box width="100%">
            <Field.Root id="apiKey">
              <Field.Label>API key</Field.Label>
              <Field.Input
                type="text"
                name="apiKey"
                value={apiKey}
                placeholder="Enter API key (leave empty to keep current)"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
              />
            </Field.Root>
          </Box>
        </Grid.Item>
        <Grid.Item col={6}>
          <Box width="100%">
            <Field.Root id="embeddingUrl">
              <Field.Label>Embedding API URL</Field.Label>
              <Field.Input
                type="text"
                name="embeddingUrl"
                value={embeddingUrl}
                placeholder="e.g. https://openrouter.ai/api/v1/embeddings"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmbeddingUrl(e.target.value)}
              />
            </Field.Root>
          </Box>
        </Grid.Item>
        <Grid.Item col={6}>
          <Box width="100%">
            <Field.Root id="embeddingModel">
              <Field.Label>Embedding model name</Field.Label>
              <Field.Input
                type="text"
                name="embeddingModel"
                value={embeddingModel}
                placeholder="e.g. text-embedding-3-large"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmbeddingModel(e.target.value)}
              />
            </Field.Root>
          </Box>
        </Grid.Item>
      </Grid.Root>
      <Flex justifyContent="flex-end" marginTop={4}>
        <Button onClick={saveSettings} disabled={isLoading || !isDirty}>
          Save
        </Button>
      </Flex>
    </Box>
  )
}
