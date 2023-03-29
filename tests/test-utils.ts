export function stringifySchema(validator, full = false) {
  return JSON.stringify(
    validator?.compiledSchema,
    (key, value) =>
      typeof value === "function"
        ? `func ${value.name} ${
            full ? value.toString().replace(/\s+/g, " ").replace(/\n/g, "") : ""
          }`.trim()
        : value,
    2
  );
}
