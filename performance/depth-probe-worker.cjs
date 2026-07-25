function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    values[argv[index].replace(/^--/, "")] = argv[index + 1];
  }
  const depth = Number(values.depth);
  if (!Number.isSafeInteger(depth) || depth < 0) {
    throw new Error("depth must be a non-negative integer");
  }
  if (
    !new Set([
      "compile",
      "validate",
      "validate-defaults",
      "validate-fail-fast",
      "compile-cycle"
    ]).has(values.operation)
  ) {
    throw new Error("unsupported operation");
  }
  return { operation: values.operation, depth };
}

function nestedSchema(depth) {
  const root = { type: "object" };
  let current = root;
  for (let index = 0; index < depth; index++) {
    const child = { type: "object" };
    current.properties = { child };
    current = child;
  }
  return root;
}

function nestedData(depth) {
  const root = {};
  let current = root;
  for (let index = 0; index < depth; index++) {
    current.child = {};
    current = current.child;
  }
  return root;
}

function recursiveSchema(withDefault = false) {
  return {
    definitions: {
      node: {
        type: "object",
        properties: {
          ...(withDefault
            ? { marker: { type: "string", default: "inserted" } }
            : {}),
          child: { $ref: "#/definitions/node" }
        },
        ...(withDefault ? { required: ["marker"] } : {})
      }
    },
    $ref: "#/definitions/node"
  };
}

function normalizeError(error) {
  const cause =
    error && typeof error.getCause === "function" ? error.getCause() : error;
  return {
    name: cause?.name || error?.name || "Error",
    message: cause?.message || error?.message || String(error),
    code: cause?.code || error?.code || null,
    rangeError: error instanceof RangeError || cause instanceof RangeError
  };
}

function loadSchemaShield() {
  if (typeof Bun !== "object") {
    require("ts-node/register");
  }
  return require("../lib").SchemaShield;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const SchemaShield = loadSchemaShield();

  try {
    if (args.operation === "compile-cycle") {
      const schema = { type: "object" };
      schema.properties = { self: schema };
      new SchemaShield({ failFast: false }).compile(schema);
    } else if (args.operation === "compile") {
      new SchemaShield({ failFast: false }).compile(nestedSchema(args.depth));
    } else {
      const failFast = args.operation === "validate-fail-fast";
      const withDefaults = args.operation === "validate-defaults";
      const input = nestedData(args.depth);
      const validate = new SchemaShield({ failFast }).compile(
        recursiveSchema(withDefaults)
      );
      const result = validate(input);
      if (!result.valid) {
        if (failFast) {
          process.stdout.write(
            JSON.stringify({
              operation: args.operation,
              depth: args.depth,
              outcome: "rejected",
              controlled: result.error === true,
              failFastSentinel: result.error === true,
              error: null
            })
          );
          return;
        }
        const error = normalizeError(result.error);
        let current = input;
        let insertedDefaults = 0;
        while (current && typeof current === "object") {
          if (Object.prototype.hasOwnProperty.call(current, "marker")) {
            insertedDefaults++;
          }
          current = current.child;
        }
        process.stdout.write(
          JSON.stringify({
            operation: args.operation,
            depth: args.depth,
            outcome: "rejected",
            controlled: error.rangeError === false,
            insertedDefaults,
            error
          })
        );
        return;
      }
    }

    process.stdout.write(
      JSON.stringify({
        operation: args.operation,
        depth: args.depth,
        outcome: "accepted",
        controlled: true,
        error: null
      })
    );
  } catch (caught) {
    const error = normalizeError(caught);
    process.stdout.write(
      JSON.stringify({
        operation: args.operation,
        depth: args.depth,
        outcome: "rejected",
        controlled: error.rangeError === false,
        error
      })
    );
    if (error.rangeError) {
      process.exitCode = 1;
    }
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}
