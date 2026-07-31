const hasOwnPropertyIntrinsic = Object.prototype.hasOwnProperty;
const hasOwnPropertyCall = Function.prototype.call.bind(
  hasOwnPropertyIntrinsic
) as (target: any, key: PropertyKey) => boolean;

export function hasOwn(target: any, key: PropertyKey): boolean {
  return hasOwnPropertyCall(target, key);
}

export function stringifySchema(validator, full = false) {
  return JSON.stringify(
    validator?.compiledSchema || validator,
    (key, value) =>
      typeof value === "function"
        ? `func ${value.name} ${
            full ? value.toString().replace(/\s+/g, " ").replace(/\n/g, "") : ""
          }`.trim()
        : value,
    2
  );
}
