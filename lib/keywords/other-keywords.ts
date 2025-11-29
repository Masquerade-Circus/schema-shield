import { hasChanged, isCompiledSchema, isObject } from "../utils";

import { KeywordFunction } from "../index";

export const OtherKeywords: Record<string, KeywordFunction> = {
  enum(schema, data, defineError) {
    const list = schema.enum;

    for (let i = 0; i < list.length; i++) {
      const enumItem = list[i];

      if (enumItem === data) {
        return;
      }

      if (
        enumItem !== null &&
        data !== null &&
        typeof enumItem === "object" &&
        typeof data === "object" &&
        !hasChanged(enumItem, data)
      ) {
        return;
      }
    }

    return defineError("Value is not one of the allowed values", { data });
  },

  allOf(schema, data, defineError) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (isObject(schema.allOf[i])) {
        if ("$validate" in schema.allOf[i]) {
          const error = schema.allOf[i].$validate(data);
          if (error) {
            return defineError("Value is not valid", { cause: error, data });
          }
        }
        continue;
      }

      if (typeof schema.allOf[i] === "boolean") {
        if (Boolean(data) !== schema.allOf[i]) {
          return defineError("Value is not valid", { data });
        }
        continue;
      }

      if (data !== schema.allOf[i]) {
        return defineError("Value is not valid", { data });
      }
    }

    return;
  },

  anyOf(schema, data, defineError) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (isObject(schema.anyOf[i])) {
        if ("$validate" in schema.anyOf[i]) {
          const error = schema.anyOf[i].$validate(data);
          if (!error) {
            return;
          }
          continue;
        }
        return;
      } else {
        if (typeof schema.anyOf[i] === "boolean") {
          if (Boolean(data) === schema.anyOf[i]) {
            return;
          }
        }

        if (data === schema.anyOf[i]) {
          return;
        }
      }
    }

    return defineError("Value is not valid", { data });
  },

  oneOf(schema, data, defineError) {
    const list = schema.oneOf;
    let validCount = 0;

    for (let i = 0; i < list.length; i++) {
      const sub = list[i];

      if (isObject(sub)) {
        if ("$validate" in sub) {
          const error = sub.$validate(data);
          if (!error) {
            validCount++;
            if (validCount > 1) {
              return defineError("Value is not valid", { data });
            }
          }
          continue;
        }
        validCount++;
        if (validCount > 1) {
          return defineError("Value is not valid", { data });
        }
        continue;
      }

      if (typeof sub === "boolean") {
        if (Boolean(data) === sub) {
          validCount++;
          if (validCount > 1) {
            return defineError("Value is not valid", { data });
          }
        }
        continue;
      }

      if (data === sub) {
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
      (isObject(data) &&
        isObject(schema.const) &&
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

    if (isObject(schema.not)) {
      if ("$validate" in schema.not) {
        const error = schema.not.$validate(data);
        if (!error) {
          return defineError("Value is not valid", { cause: error, data });
        }
        return;
      }
      return defineError("Value is not valid", { data });
    }

    return defineError("Value is not valid", { data });
  },

  $ref(schema, data, defineError, instance) {
    if (schema._resolvedRef) {
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
    return schema._resolvedRef(data);
  }
};
