import { isCompiledSchema } from "../utils/main-utils";

import { KeywordFunction } from "../index";
import { hasChanged } from "../utils/has-changed";

type BranchEntry =
  | { kind: "validate"; validate: (data: any) => any }
  | { kind: "alwaysValid" }
  | { kind: "alwaysInvalid" }
  | { kind: "literal"; value: any };

function toBranchEntry(item: any): BranchEntry {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    if ("$validate" in item && typeof item.$validate === "function") {
      return { kind: "validate", validate: item.$validate };
    }

    return { kind: "alwaysValid" };
  }

  if (typeof item === "boolean") {
    return { kind: item ? "alwaysValid" : "alwaysInvalid" };
  }

  return { kind: "literal", value: item };
}

function getBranchEntries(schema: any, key: "allOf" | "anyOf" | "oneOf") {
  const cacheKey = `_${key}BranchEntries`;
  let entries = schema[cacheKey] as BranchEntry[] | undefined;

  if (entries) {
    return entries;
  }

  const source = schema[key] || [];
  entries = [];

  for (let i = 0; i < source.length; i++) {
    entries.push(toBranchEntry(source[i]));
  }

  Object.defineProperty(schema, cacheKey, {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return entries;
}

export const OtherKeywords: Record<string, KeywordFunction> = {
  enum(schema, data, defineError) {
    let enumCache = (schema as any)._enumCache as
      | { primitiveSet: Set<any>; objectValues: any[] }
      | undefined;

    if (!enumCache) {
      const primitiveSet = new Set<any>();
      const objectValues: any[] = [];
      const list = schema.enum;

      for (let i = 0; i < list.length; i++) {
        const enumItem = list[i];
        if (enumItem !== null && typeof enumItem === "object") {
          objectValues.push(enumItem);
        } else {
          primitiveSet.add(enumItem);
        }
      }

      enumCache = { primitiveSet, objectValues };
      Object.defineProperty(schema, "_enumCache", {
        value: enumCache,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }

    if (
      !(typeof data === "number" && Number.isNaN(data)) &&
      enumCache.primitiveSet.has(data)
    ) {
      return;
    }

    if (data !== null && typeof data === "object") {
      // Conservative exact-semantics path.
      // Future opt-in optimization: structural hashing buckets for large enums.
      for (let i = 0; i < enumCache.objectValues.length; i++) {
        if (!hasChanged(enumCache.objectValues[i], data)) {
          return;
        }
      }
    }

    return defineError("Value is not one of the allowed values", { data });
  },

  allOf(schema, data, defineError) {
    const branches = getBranchEntries(schema, "allOf");

    if (branches.length === 1) {
      const onlyBranch = branches[0];

      if (onlyBranch.kind === "validate") {
        const error = onlyBranch.validate(data);
        if (error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        return;
      }

      if (onlyBranch.kind === "alwaysValid") {
        return;
      }

      if (onlyBranch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }

      if (data !== onlyBranch.value) {
        return defineError("Value is not valid", { data });
      }

      return;
    }

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];

      if (branch.kind === "validate") {
        const error = branch.validate(data);
        if (error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        continue;
      }

      if (branch.kind === "alwaysValid") {
        continue;
      }

      if (branch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }

      if (data !== branch.value) {
        return defineError("Value is not valid", { data });
      }
    }

    return;
  },

  anyOf(schema, data, defineError) {
    const branches = getBranchEntries(schema, "anyOf");

    if (branches.length === 1) {
      const onlyBranch = branches[0];

      if (onlyBranch.kind === "validate") {
        const error = onlyBranch.validate(data);
        if (!error) {
          return;
        }
        return defineError("Value is not valid", { data });
      }

      if (onlyBranch.kind === "alwaysValid") {
        return;
      }

      if (onlyBranch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }

      if (data === onlyBranch.value) {
        return;
      }

      return defineError("Value is not valid", { data });
    }

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];

      if (branch.kind === "validate") {
        const error = branch.validate(data);
        if (!error) {
          return;
        }
        continue;
      }

      if (branch.kind === "alwaysValid") {
        return;
      }

      if (branch.kind === "alwaysInvalid") {
        continue;
      }

      if (data === branch.value) {
        return;
      }
    }

    return defineError("Value is not valid", { data });
  },

  oneOf(schema, data, defineError) {
    const branches = getBranchEntries(schema, "oneOf");

    if (branches.length === 1) {
      const onlyBranch = branches[0];

      if (onlyBranch.kind === "validate") {
        const error = onlyBranch.validate(data);
        if (!error) {
          return;
        }
        return defineError("Value is not valid", { data });
      }

      if (onlyBranch.kind === "alwaysValid") {
        return;
      }

      if (onlyBranch.kind === "alwaysInvalid") {
        return defineError("Value is not valid", { data });
      }

      if (data === onlyBranch.value) {
        return;
      }

      return defineError("Value is not valid", { data });
    }

    let validCount = 0;

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      let isValid = false;

      if (branch.kind === "validate") {
        isValid = !branch.validate(data);
      } else if (branch.kind === "alwaysValid") {
        isValid = true;
      } else if (branch.kind === "alwaysInvalid") {
        isValid = false;
      } else {
        isValid = data === branch.value;
      }

      if (isValid) {
        validCount++;
        if (validCount > 1) {
          return defineError("Value is not valid", { data });
        }
      }
    }

    if (validCount === 1) {
      return;
    }

    return defineError("Value is not valid", { data });
  },

  const(schema, data, defineError) {
    if (data === schema.const) {
      return;
    }

    if (
      (data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        schema.const &&
        typeof schema.const === "object" &&
        !Array.isArray(schema.const) &&
        !hasChanged(data, schema.const)) ||
      (Array.isArray(data) &&
        Array.isArray(schema.const) &&
        !hasChanged(data, schema.const))
    ) {
      return;
    }
    return defineError("Value is not valid", { data });
  },

  if(schema, data) {
    if ("then" in schema === false && "else" in schema === false) {
      return;
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (isCompiledSchema(schema.then)) {
          return schema.then.$validate(data);
        }
      } else if (isCompiledSchema(schema.else)) {
        return schema.else.$validate(data);
      }
      return;
    }

    if (!isCompiledSchema(schema.if)) {
      return;
    }

    const error = schema.if.$validate(data);
    if (!error) {
      if (isCompiledSchema(schema.then)) {
        return schema.then.$validate(data);
      }
      return;
    } else {
      if (isCompiledSchema(schema.else)) {
        return schema.else.$validate(data);
      }
      return;
    }
  },

  not(schema, data, defineError) {
    if (typeof schema.not === "boolean") {
      if (schema.not) {
        return defineError("Value is not valid", { data });
      }
      return;
    }

    if (
      schema.not &&
      typeof schema.not === "object" &&
      !Array.isArray(schema.not)
    ) {
      if ("$validate" in schema.not) {
        const error = (schema.not as any).$validate(data);
        if (!error) {
          return defineError("Value is not valid", { data });
        }
        return;
      }
      return defineError("Value is not valid", { data });
    }

    return defineError("Value is not valid", { data });
  },

  $ref(schema, data, defineError, instance) {
    if (schema._resolvedRef) {
      if (schema.$validate !== schema._resolvedRef) {
        schema.$validate = schema._resolvedRef;
      }

      return schema._resolvedRef(data);
    }

    const refPath = schema.$ref;
    let targetSchema = instance.getSchemaRef(refPath);

    if (!targetSchema) {
      targetSchema = instance.getSchemaById(refPath);
    }

    if (!targetSchema) {
      return defineError(`Missing reference: ${refPath}`);
    }

    if (!targetSchema.$validate) {
      return;
    }

    schema._resolvedRef = targetSchema.$validate;
    schema.$validate = schema._resolvedRef;
    return schema._resolvedRef(data);
  }
};
