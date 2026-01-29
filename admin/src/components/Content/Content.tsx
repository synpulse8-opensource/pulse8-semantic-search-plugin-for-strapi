import React from "react";
import { Box, Button, Checkbox, Field, Flex, Grid, IconButton, Typography } from "@strapi/design-system";
import { Table, Thead, Tbody, Tr, Th, Td } from "@strapi/design-system";
import { Trash } from "@strapi/icons";
import { usePluginSettings } from "../../hooks/usePluginSettings";

interface IContentProps {
  pluginSettingsHook: ReturnType<typeof usePluginSettings>;
}

export const Content: React.FC<IContentProps> = ({ pluginSettingsHook }) => {
  const {
    contentTypes,
    autoGenerate,
    setAutoGenerate,
    searchLimit,
    setSearchLimit,
    searchThreshold,
    setSearchThreshold,
    searchLocale,
    setSearchLocale,
    validateAndSave,
    validationErrors,
    isLoading,
    isDirty,
    addContentType,
    removeContentType,
    updateContentType,
    updateFields,
  } = pluginSettingsHook;

  return (
    <Box padding={5}>
      <Flex justifyContent="space-between">
        <Typography variant="omega" fontWeight="bold">
          Content Types Configuration
        </Typography>
        <Button variant="secondary" onClick={addContentType}>
          Add Content Type
        </Button>
      </Flex>
      <Box marginTop={4} marginBottom={4}>
        <Checkbox
          checked={autoGenerate}
          onCheckedChange={(checked: boolean) => setAutoGenerate(checked)}
        >
          Auto-generate embeddings on content create/update
        </Checkbox>
      </Box>
      <Table colCount={3} rowCount={contentTypes.length + 1}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Content Type</Typography></Th>
            <Th><Typography variant="sigma">Searchable fields (comma-separated)</Typography></Th>
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {contentTypes.length > 0 ? (
            contentTypes.map((ct, index) => (
              <Tr key={index}>
                <Td>
                  <Field.Root error={validationErrors[index]?.contentType}>
                    <Field.Input
                      value={ct.contentType}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateContentType(index, e.target.value)}
                      placeholder="api::example.example"
                    />
                    <Field.Error />
                  </Field.Root>
                </Td>
                <Td>
                  <Field.Root error={validationErrors[index]?.fields}>
                    <Field.Input
                      value={ct.fieldsRaw || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFields(index, e.target.value)}
                      placeholder="title, description, content"
                    />
                    <Field.Error />
                  </Field.Root>
                </Td>
                <Td>
                  <IconButton onClick={() => removeContentType(index)} label="Delete">
                    <Trash />
                  </IconButton>
                </Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={3}>
                <Typography variant="delta" textColor="neutral600">
                  No content types configured
                </Typography>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
      <Box marginTop={6}>
        <Typography variant="omega" fontWeight="bold">
          Search Defaults
        </Typography>
        <Grid.Root gap={4} marginTop={2}>
          <Grid.Item col={4}>
            <Box width="100%">
              <Field.Root>
                <Field.Label>Limit (number of documents returned)</Field.Label>
                <Field.Input
                  type="number"
                  value={searchLimit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchLimit(Number(e.target.value))}
                  placeholder="10"
                  min={1}
                  max={100}
                />
              </Field.Root>
            </Box>
          </Grid.Item>
          <Grid.Item col={4}>
            <Box width="100%">
              <Field.Root>
                <Field.Label>Similarity threshold</Field.Label>
                <Field.Input
                  type="number"
                  value={searchThreshold}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchThreshold(Number(e.target.value))}
                  placeholder="0.3"
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Field.Root>
            </Box>
          </Grid.Item>
          <Grid.Item col={4}>
            <Box width="100%">
              <Field.Root>
                <Field.Label>Locale</Field.Label>
                <Field.Input
                  type="text"
                  value={searchLocale}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchLocale(e.target.value)}
                  placeholder="en"
                />
              </Field.Root>
            </Box>
          </Grid.Item>
        </Grid.Root>
      </Box>
      <Flex justifyContent="flex-end" gap={2} marginTop={4}>
        <Button onClick={validateAndSave} disabled={isLoading || !isDirty}>
          Save
        </Button>
      </Flex>
    </Box>
  );
}
