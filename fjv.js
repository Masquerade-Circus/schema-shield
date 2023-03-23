const DefaultOptions = {
  allErrors: false,
  verbose: false,
  nullable: false,
  logger: console
};

class FJValidator {
  constructor(options = DefaultOptions) {
    this.options = { ...options };
    this.keywords = new Map();
    this.types = new Map();
    this.formats = new Map();
    this.schemas = new Map();
  }

  addKeyword(keyword, validatorFunction, type = "all") {
    this.keywords.set(keyword, { validatorFunction, type });
  }

  addType(type, validatorFunction) {
    this.types.set(type, validatorFunction);
  }

  addFormat(format, validatorFunction) {
    this.formats.set(format, validatorFunction);
  }

  addSchema(schema) {
    this.schemas.set(schema.$id, schema);
  }

  compile(schema) {
    return (data) => this.validate(schema, data);
  }

  validate(schema, data, pointer = "") {
    const type = schema.type;
    const validatorFunction = this.types.get(type);

    if (!validatorFunction) {
      return {
        valid: false,
        errors: [
          {
            pointer,
            value: data,
            code: "unsupported_type",
            message: `Unsupported type: ${type}`
          }
        ]
      };
    }

    if (typeof data !== "undefined") {
      let { valid, errors } = validatorFunction(schema, data, this, pointer);

      // Test nullable
      if (!valid) {
        const nullableValidator = this.keywords.get("nullable");
        if (
          nullableValidator &&
          (nullableValidator.type === "all" || nullableValidator.type === type)
        ) {
          const nullable = nullableValidator.validatorFunction(
            schema,
            data,
            this,
            pointer
          );
          if (nullable.valid) {
            return { valid: true, errors: [] };
          }
        }

        return { valid: false, errors };
      }

      // Test keywords
      for (const keyword of this.keywords.keys()) {
        // Skip nullable (already tested)
        if (keyword === "nullable") {
          continue;
        }

        // If the schema has not defined the keyword, skip it
        if (keyword in schema === false) {
          continue;
        }

        const keywordValidator = this.keywords.get(keyword);
        if (
          keywordValidator &&
          (keywordValidator.type === "all" || keywordValidator.type === type)
        ) {
          const keywordResult = keywordValidator.validatorFunction(
            schema,
            data,
            this,
            pointer
          );
          if (!keywordResult.valid) {
            return { valid: false, errors: keywordResult.errors };
          }
        }
      }
    }

    return { valid: true, errors: [] };
  }
}

const validateObject = (schema, data, fjv, pointer = "") => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          pointer,
          value: data,
          code: "not_object",
          message: "Data is not an object"
        }
      ]
    };
  }

  const errors = [];
  for (const key in schema.properties) {
    const validationResult = fjv.validate(
      schema.properties[key],
      data[key],
      `${pointer}/${key}`
    );
    if (!validationResult.valid) {
      errors.push(...validationResult.errors);
    }
  }
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateArray = (schema, data, fjv, pointer = "") => {
  if (!Array.isArray(data)) {
    return {
      valid: false,
      errors: [
        {
          pointer,
          value: data,
          code: "not_array",
          message: "Data is not an array"
        }
      ]
    };
  }

  const errors = [];
  data.forEach((item, index) => {
    const validationResult = fjv.validate(
      schema.items,
      item,
      `${pointer}/${index}`
    );
    if (!validationResult.valid) {
      errors.push(...validationResult.errors);
    }
  });
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
};

const validateString = (schema, data) => {
  if (typeof data !== "string") {
    return { valid: false, errors: ["Data is not a string"] };
  }
  return { valid: true };
};

const validateNumber = (schema, data) => {
  if (typeof data !== "number") {
    return { valid: false, errors: ["Data is not a number"] };
  }
  return { valid: true };
};

const validateInteger = (schema, data) => {
  if (!Number.isInteger(data)) {
    return { valid: false, errors: ["Data is not an integer"] };
  }
  return { valid: true };
};

const validateBoolean = (schema, data) => {
  if (typeof data !== "boolean") {
    return { valid: false, errors: ["Data is not a boolean"] };
  }
  return { valid: true };
};

const validateNull = (schema, data) => {
  if (data !== null) {
    return { valid: false, errors: ["Data is not null"] };
  }
  return { valid: true };
};

const validateNullable = validateNull;

const validateMin = (schema, data) => {
  if (data < schema.min) {
    return {
      valid: false,
      errors: [`Data is less than the minimum value of ${schema.min}`]
    };
  }
  return { valid: true };
};

const validateMax = (schema, data) => {
  if (data > schema.max) {
    return {
      valid: false,
      errors: [`Data is greater than the maximum value of ${schema.max}`]
    };
  }
  return { valid: true };
};

const validateMinLength = (schema, data) => {
  if (data.length < schema.minLength) {
    return {
      valid: false,
      errors: [
        `Data length is less than the minimum length of ${schema.minLength}`
      ]
    };
  }
  return { valid: true };
};

const validateMaxLength = (schema, data) => {
  if (data.length > schema.maxLength) {
    return {
      valid: false,
      errors: [
        `Data length is greater than the maximum length of ${schema.maxLength}`
      ]
    };
  }
  return { valid: true };
};

const validatePattern = (schema, data) => {
  const regex = new RegExp(schema.pattern);
  if (!regex.test(data)) {
    return {
      valid: false,
      errors: [`Data does not match the pattern: ${schema.pattern}`]
    };
  }

  return { valid: true };
};

const validateFormat = (schema, data, fjv) => {
  const formatValidator = fjv.formats.get(schema.format);
  if (formatValidator) {
    const validationResult = formatValidator(data);
    if (!validationResult.valid) {
      return validationResult;
    }
  } else {
    return { valid: false, errors: [`Unsupported format: ${schema.format}`] };
  }

  return { valid: true };
};

const validateRequired = (schema, data) => {
  for (const key of schema.required) {
    if (data[key] === undefined) {
      return { valid: false, errors: [`Missing required property: ${key}`] };
    }
  }
  return { valid: true };
};

class FJV {
  constructor(options = DefaultOptions): F {
    let fjv = new FJValidator(options);

    fjv.addType("object", validateObject);
    fjv.addType("array", validateArray);
    fjv.addType("string", validateString);
    fjv.addType("number", validateNumber);
    fjv.addType("integer", validateInteger);
    fjv.addType("boolean", validateBoolean);
    fjv.addType("null", validateNull);

    fjv.addKeyword("nullable", validateNullable);
    fjv.addKeyword("min", validateMin, "number");
    fjv.addKeyword("max", validateMax, "number");
    fjv.addKeyword("minLength", validateMinLength, "string");
    fjv.addKeyword("maxLength", validateMaxLength, "string");
    fjv.addKeyword("pattern", validatePattern, "string");
    fjv.addKeyword("format", validateFormat, "string");
    fjv.addKeyword("required", validateRequired, "object");

    return fjv;
  }
}

module.exports = FJV;
