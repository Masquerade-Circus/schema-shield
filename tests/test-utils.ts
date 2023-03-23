export function stringifySchema(validator) {
  return JSON.stringify(
    validator?.compiledSchema,
    (key, value) =>
      typeof value === "function" ? `func ${value.name}` : value,
    2
  );
}
