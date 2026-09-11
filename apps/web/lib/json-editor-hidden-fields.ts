export function omitJsonEditorFields(
  value: Record<string, unknown>,
  hiddenFields: readonly string[],
) {
  const editableValue = { ...value };
  hiddenFields.forEach((field) => delete editableValue[field]);
  return editableValue;
}

export function restoreJsonEditorFields(
  originalValue: Record<string, unknown>,
  editedValue: Record<string, unknown>,
  hiddenFields: readonly string[],
) {
  const restoredValue = { ...editedValue };
  hiddenFields.forEach((field) => {
    if (Object.hasOwn(originalValue, field)) {
      restoredValue[field] = originalValue[field];
    }
  });
  return restoredValue;
}
