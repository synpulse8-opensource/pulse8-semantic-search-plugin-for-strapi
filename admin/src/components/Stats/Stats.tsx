import React from "react";
import { Box, Button, Dialog, Flex, ProgressBar, Typography } from "@strapi/design-system";
import { Table, Thead, Tbody, Tr, Th, Td } from "@strapi/design-system";
import { ArrowClockwise, Play, Trash } from "@strapi/icons";
import { useStats } from "../../hooks/useStats";

interface IStatsProps {
  statsHook: ReturnType<typeof useStats>;
}

export const Stats: React.FC<IStatsProps> = ({ statsHook }) => {
  const { 
    stats, 
    isLoading, 
    error, 
    refetch, 
    regenerateContentType, 
    regenerateAll, 
    regeneratingContentType,
    deleteContentType,
    deleteAll,
    deletingContentType,
  } = statsHook;

  const contentTypes = Object.keys(stats);
  const isRegenerating = regeneratingContentType !== null;
  const isDeleting = deletingContentType !== null;
  const isBusy = isRegenerating || isDeleting;

  if (error) {
    return (
      <Box padding={5}>
        <Typography variant="delta" textColor="danger600">
          {error}
        </Typography>
        <Box marginTop={4}>
          <Button onClick={refetch} startIcon={<ArrowClockwise />}>
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box padding={5}>
      <Flex justifyContent="space-between" style={{ marginBottom: 16 }}>
        <Typography variant="omega" fontWeight="bold">
          Embedding Coverage Statistics
        </Typography>
        <Flex gap={2}>
          <Button 
            variant="default" 
            onClick={regenerateAll} 
            disabled={isLoading || isBusy || contentTypes.length === 0}
            startIcon={<Play />}
          >
            {regeneratingContentType === 'all' ? 'Regenerating...' : 'Regenerate all embeddings'}
          </Button>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button 
                variant="danger" 
                disabled={isLoading || isBusy || contentTypes.length === 0}
                startIcon={<Trash />}
              >
                {deletingContentType === 'all' ? 'Deleting...' : 'Delete all embeddings'}
              </Button>
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>Confirm Deletion</Dialog.Header>
              <Dialog.Body>
                <Typography variant="omega">
                  Are you sure you want to delete <Typography tag="span" fontWeight="bold">all</Typography> embeddings? This action cannot be undone.
                </Typography>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.Cancel>
                  <Button fullWidth variant="tertiary">Cancel</Button>
                </Dialog.Cancel>
                <Dialog.Action>
                  <Button fullWidth variant="danger" onClick={deleteAll}>Confirm</Button>
                </Dialog.Action>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
          <Button 
            variant="secondary" 
            onClick={refetch} 
            disabled={isLoading || isBusy}
            startIcon={<ArrowClockwise />}
          >
            Refresh stats
          </Button>
        </Flex>
      </Flex>
      <Table colCount={5} rowCount={contentTypes.length + 1}>
        <Thead>
          <Tr>
            <Th><Typography variant="sigma">Content Type</Typography></Th>
            <Th><Typography variant="sigma">Total Entities</Typography></Th>
            <Th><Typography variant="sigma">With Embeddings</Typography></Th>
            <Th><Typography variant="sigma">Coverage</Typography></Th>
            <Th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>
              <Typography variant="sigma">Actions</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {isLoading ? (
            <Tr>
              <Td colSpan={5}>
                <Typography variant="delta" textColor="neutral600">
                  Loading statistics...
                </Typography>
              </Td>
            </Tr>
          ) : contentTypes.length > 0 ? (
            contentTypes.map((contentType) => {
              const stat = stats[contentType];
              const isThisRegenerating = regeneratingContentType === contentType || regeneratingContentType === 'all';
              const isThisDeleting = deletingContentType === contentType || deletingContentType === 'all';
              return (
                <Tr key={contentType}>
                  <Td>
                    <Typography variant="omega">{contentType}</Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega">{stat.total}</Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega">{stat.withEmbeddings}</Typography>
                  </Td>
                  <Td>
                    <Typography variant="omega">{stat.coverage}%</Typography>
                  </Td>
                  <Td style={{ whiteSpace: 'nowrap' }}>
                    <Flex gap={1} justifyContent="flex-end">
                      <Button
                        variant="secondary"
                        size="S"
                        onClick={() => regenerateContentType(contentType)}
                        disabled={isBusy}
                        startIcon={<Play />}
                      >
                        {isThisRegenerating ? 'Regenerating...' : 'Regenerate embeddings'}
                      </Button>
                      <Dialog.Root>
                        <Dialog.Trigger>
                          <Button
                            variant="danger"
                            size="S"
                            disabled={isBusy}
                            startIcon={<Trash />}
                          >
                            {isThisDeleting ? 'Deleting...' : 'Delete embeddings'}
                          </Button>
                        </Dialog.Trigger>
                        <Dialog.Content>
                          <Dialog.Header>Confirm Deletion</Dialog.Header>
                          <Dialog.Body>
                            <Typography variant="omega">
                              Are you sure you want to delete all embeddings for <Typography tag="span" fontWeight="bold">{contentType}</Typography>? This action cannot be undone.
                            </Typography>
                          </Dialog.Body>
                          <Dialog.Footer>
                            <Dialog.Cancel>
                              <Button fullWidth variant="tertiary">Cancel</Button>
                            </Dialog.Cancel>
                            <Dialog.Action>
                              <Button fullWidth variant="danger" onClick={() => deleteContentType(contentType)}>Confirm</Button>
                            </Dialog.Action>
                          </Dialog.Footer>
                        </Dialog.Content>
                      </Dialog.Root>
                    </Flex>
                  </Td>
                </Tr>
              );
            })
          ) : (
            <Tr>
              <Td colSpan={5}>
                <Box paddingTop={4} paddingBottom={4}>
                  <Typography variant="delta" textColor="neutral600">
                    No content types configured. Add content types in the Collections tab.
                  </Typography>
                </Box>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    </Box>
  );
};
