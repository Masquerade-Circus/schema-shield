import {
  definePropertyOrThrow,
  isCompiledSchema
} from "../utils/main-utils";
import type {
  KeywordFunction,
  Result,
  ValidateFunction,
  ValidateSubschemaFunction
} from "../index";
import type { DefineErrorFunction } from "../utils/main-utils";
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

  definePropertyOrThrow(schema, cacheKey, {
    value: entries,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return entries;
}

type CombinatorKey = "allOf" | "anyOf" | "oneOf";
type DefaultMutation = { target: Record<string, any>; key: string; value: any };
type TransactionHooks = {
  savepoint: () => number;
  rollback: (savepoint: number) => void;
  capture: (savepoint: number) => DefaultMutation[];
  restore: (mutations: DefaultMutation[]) => void;
};

function evaluateAllOf(
  branches: BranchEntry[],
  data: any,
  defineError: DefineErrorFunction
): Result {
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
    if (branch.kind === "alwaysInvalid" || data !== branch.value) {
      return defineError("Value is not valid", { data });
    }
  }
}

function evaluateAnyOf(
  branches: BranchEntry[],
  data: any,
  defineError: DefineErrorFunction,
  collectAll = false
): Result {
  let matched = false;
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    if (branch.kind === "validate") {
      if (!branch.validate(data)) {
        matched = true;
        if (!collectAll) {
          return;
        }
      }
      continue;
    }
    if (branch.kind === "alwaysValid") {
      matched = true;
      if (!collectAll) {
        return;
      }
      continue;
    }
    if (branch.kind === "literal" && data === branch.value) {
      matched = true;
      if (!collectAll) {
        return;
      }
    }
  }
  if (matched) {
    return;
  }
  return defineError("Value is not valid", { data });
}

function evaluateOneOf(
  branches: BranchEntry[],
  data: any
): number {
  let winnerIndex = -1;
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    let isValid = false;
    if (branch.kind === "validate") {
      isValid = !branch.validate(data);
    } else if (branch.kind === "alwaysValid") {
      isValid = true;
    } else if (branch.kind === "literal") {
      isValid = data === branch.value;
    }
    if (isValid) {
      if (winnerIndex !== -1) {
        return -1;
      }
      winnerIndex = i;
    }
  }
  return winnerIndex;
}

export function createCombinatorValidator(
  key: CombinatorKey,
  schema: any,
  defineError: DefineErrorFunction,
  validateSubschema?: ValidateSubschemaFunction,
  transactions?: TransactionHooks,
  collectAnnotations = false
): ValidateFunction {
  const sourceBranches = getBranchEntries(schema, key);
  const branches = validateSubschema
    ? sourceBranches.map((branch, index): BranchEntry =>
        branch.kind === "validate"
          ? {
              kind: "validate",
              validate: (data) => validateSubschema(schema[key][index], data)
            }
          : branch
      )
    : sourceBranches;

  if (!transactions) {
    if (key === "allOf") {
      return (data) => evaluateAllOf(branches, data, defineError);
    }
    if (key === "anyOf") {
      return (data) =>
        evaluateAnyOf(branches, data, defineError, collectAnnotations);
    }
    return (data) => {
      if (evaluateOneOf(branches, data) === -1) {
        return defineError("Value is not valid", { data });
      }
    };
  }

  if (key === "allOf") {
    return (data) => {
      const savepoint = transactions.savepoint();
      try {
        const error = evaluateAllOf(branches, data, defineError);
        if (error) {
          transactions.rollback(savepoint);
        }
        return error;
      } catch (error) {
        transactions.rollback(savepoint);
        throw error;
      }
    };
  }

  if (key === "anyOf") {
    return (data) =>
      evaluateAnyOf(branches, data, defineError, collectAnnotations);
  }

  return (data) => {
    const savepoint = transactions.savepoint();
    let winnerIndex = -1;
    let winnerDefaults: DefaultMutation[] = [];
    try {
      for (let index = 0; index < branches.length; index++) {
        const branch = branches[index];
        const branchSavepoint = transactions.savepoint();
        let isValid = false;
        if (branch.kind === "validate") {
          isValid = !branch.validate(data);
        } else if (branch.kind === "alwaysValid") {
          isValid = true;
        } else if (branch.kind === "literal") {
          isValid = data === branch.value;
        }
        if (!isValid) {
          continue;
        }
        if (winnerIndex !== -1) {
          transactions.rollback(savepoint);
          return defineError("Value is not valid", { data });
        }
        winnerIndex = index;
        winnerDefaults = transactions.capture(branchSavepoint);
      }
      if (winnerIndex === -1) {
        transactions.rollback(savepoint);
        return defineError("Value is not valid", { data });
      }
      transactions.restore(winnerDefaults);
      return;
    } catch (error) {
      transactions.rollback(savepoint);
      throw error;
    }
  };
}

export function prepareCombinatorEntries(schema: any) {
  if (Array.isArray(schema.allOf)) {
    getBranchEntries(schema, "allOf");
  }
  if (Array.isArray(schema.anyOf)) {
    getBranchEntries(schema, "anyOf");
  }
  if (Array.isArray(schema.oneOf)) {
    getBranchEntries(schema, "oneOf");
  }
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
      definePropertyOrThrow(schema, "_enumCache", {
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
    return createCombinatorValidator("allOf", schema, defineError)(data);
  },

  anyOf(schema, data, defineError) {
    return createCombinatorValidator("anyOf", schema, defineError)(data);
  },

  oneOf(schema, data, defineError) {
    return createCombinatorValidator("oneOf", schema, defineError)(data);
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

  if(schema, data, defineError, _instance, validateSubschema) {
    if (
      "then" in schema === false &&
      "else" in schema === false &&
      !validateSubschema?.tracksEvaluated
    ) {
      return;
    }
    if (typeof schema.if === "boolean") {
      if (schema.if) {
        if (schema.then === false) {
          return defineError("Value is not valid", { data });
        }
        if (isCompiledSchema(schema.then)) {
          return validateSubschema
            ? validateSubschema(schema.then, data)
            : schema.then.$validate(data);
        }
      } else {
        if (schema.else === false) {
          return defineError("Value is not valid", { data });
        }
        if (isCompiledSchema(schema.else)) {
          return validateSubschema
            ? validateSubschema(schema.else, data)
            : schema.else.$validate(data);
        }
      }
      return;
    }

    if (!isCompiledSchema(schema.if)) {
      return;
    }

    const error = validateSubschema
      ? validateSubschema(schema.if, data)
      : schema.if.$validate(data);
    if (!error) {
      if (schema.then === false) {
        return defineError("Value is not valid", { data });
      }
      if (isCompiledSchema(schema.then)) {
        return validateSubschema
          ? validateSubschema(schema.then, data)
          : schema.then.$validate(data);
      }
      return;
    } else {
      if (schema.else === false) {
        return defineError("Value is not valid", { data });
      }
      if (isCompiledSchema(schema.else)) {
        return validateSubschema
          ? validateSubschema(schema.else, data)
          : schema.else.$validate(data);
      }
      return;
    }
  },

  not(schema, data, defineError, _instance, validateSubschema) {
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
        const savepoint = validateSubschema?.savepoint?.();
        try {
          const error = validateSubschema
            ? validateSubschema(schema.not, data, { discardAnnotations: true })
            : (schema.not as any).$validate(data);
          if (!error) {
            return defineError("Value is not valid", { data });
          }
          return;
        } finally {
          if (typeof savepoint === "number") {
            validateSubschema?.rollback?.(savepoint);
          }
        }
      }
      return defineError("Value is not valid", { data });
    }

    return defineError("Value is not valid", { data });
  },

  $ref(schema, data, defineError) {
    if (typeof schema._resolvedRef === "function") {
      return schema._resolvedRef(data);
    }

    return defineError(`Missing reference: ${schema.$ref}`);
  }
};
