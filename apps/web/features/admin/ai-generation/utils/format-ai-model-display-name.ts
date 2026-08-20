const DATED_MODEL_SNAPSHOT_SUFFIX = /-\d{4}-\d{2}-\d{2}$/;

/**
 * Keeps the persisted/provider model identifier intact while hiding a trailing
 * dated snapshot suffix in human-facing metadata.
 */
export function formatAiModelDisplayName(model: string) {
  return model.replace(DATED_MODEL_SNAPSHOT_SUFFIX, "");
}
