import { isCompiledSchema } from "../utils/main-utils";
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

  Object.defineProperty(schema, cacheKey, {
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
  defineError: DefineErrorFunction
): Result {
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i];
    if (branch.kind === "validate") {
      if (!branch.validate(data)) {
        return;
      }
      continue;
    }
    if (branch.kind === "alwaysValid") {
      return;
    }
    if (branch.kind === "literal" && data === branch.value) {
      return;
    }
  }
  return defineError("Value is not valid", { data });
}

function evaluateOneOf(
  branches: BranchEntry[],
  data: any,
  defineError: DefineErrorFunction
): { error: Result; winnerIndex: number } {
  let validCount = 0;
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
      validCount++;
      winnerIndex = i;
      if (validCount > 1) {
        return {
          error: defineError("Value is not valid", { data }),
          winnerIndex: -1
        };
      }
    }
  }
  return {
    error:
      validCount === 1
        ? undefined
        : defineError("Value is not valid", { data }),
    winnerIndex: validCount === 1 ? winnerIndex : -1
  };
}

export function createCombinatorValidator(
  key: CombinatorKey,
  schema: any,
  defineError: DefineErrorFunction,
  validateSubschema?: ValidateSubschemaFunction,
  transactions?: TransactionHooks
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
      return (data) => evaluateAnyOf(branches, data, defineError);
    }
    return (data) => evaluateOneOf(branches, data, defineError).error;
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
    return (data) => evaluateAnyOf(branches, data, defineError);
  }

  return (data) => {
    const savepoint = transactions.savepoint();
    const defaultsByBranch: DefaultMutation[][] = [];
    const isolatedBranches = branches.map((branch, index): BranchEntry =>
      branch.kind === "validate"
        ? {
            kind: "validate",
            validate: (value) => {
              const branchSavepoint = transactions.savepoint();
              const error = branch.validate(value);
              if (!error) {
                defaultsByBranch[index] = transactions.capture(branchSavepoint);
              }
              return error;
            }
          }
        : branch
    );
    try {
      const result = evaluateOneOf(isolatedBranches, data, defineError);
      if (result.error) {
        transactions.rollback(savepoint);
        return result.error;
      }
      transactions.restore(defaultsByBranch[result.winnerIndex] || []);
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
