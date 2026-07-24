const { SchemaShield, ValidationError } = require("../lib")

if (typeof global.gc !== "function") {
  throw new Error("Run with node --expose-gc")
}

const MAX_DEPTH = 1024
const AUXILIARY_LIMIT_BYTES = 32 * 1024 * 1024
const RETAINED_LIMIT_BYTES = 16 * 1024 * 1024

function heapUsed() {
  global.gc()
  global.gc()
  return process.memoryUsage().heapUsed
}

function currentHeapUsed() {
  return process.memoryUsage().heapUsed
}

function createCase(kind, depth, invalid = false) {
  if (kind === "ref") {
    const schema = {
      type: "object",
      properties: { next: { $ref: "#" }, value: { type: "string" } },
      additionalProperties: false
    }
    let data = invalid ? { value: 1 } : { value: "leaf" }
    for (let i = 0; i < depth; i++) {
      data = { next: data }
    }
    return { schema, data }
  }

  let schema = { type: "string" }
  let data = invalid ? 1 : "leaf"
  for (let i = 0; i < depth; i++) {
    if (kind === "branched-object") {
      schema = {
        type: "object",
        properties: { next: schema, marker: { type: "number" } },
        required: ["next", "marker"]
      }
      data = { next: data, marker: i }
    } else if (kind === "multi-array") {
      schema = {
        type: "array",
        items: [schema, { type: "number" }],
        additionalItems: false
      }
      data = [data, i]
    } else {
      schema = {
        allOf: [
          {
            type: "object",
            properties: { next: schema },
            required: ["next"]
          },
          { type: "object" }
        ]
      }
      data = { next: data }
    }
  }
  return { schema, data }
}

function countTreeNodes(tree) {
  let count = 0
  let current = tree
  while (current) {
    count++
    current = current.cause
  }
  return count
}

function measure(kind, depth) {
  const validCase = createCase(kind, depth)
  const invalidCase = createCase(kind, depth, true)
  const fastShield = new SchemaShield({ failFast: true, maxDepth: MAX_DEPTH })
  const detailedShield = new SchemaShield({ failFast: false, maxDepth: MAX_DEPTH })
  const validateFast = fastShield.compile(validCase.schema)
  const validateDetailed = detailedShield.compile(validCase.schema)
  const beforeWarmup = heapUsed()
  let peakHeap = beforeWarmup

  for (let i = 0; i < 20; i++) {
    if (!validateFast(validCase.data).valid || validateFast(invalidCase.data).valid) {
      throw new Error(`${kind} ${depth} warmup validation diverged`)
    }
    peakHeap = Math.max(peakHeap, currentHeapUsed())
  }

  const afterWarmupRetained = heapUsed()
  const detailedResult = validateDetailed(invalidCase.data)
  if (detailedResult.valid || !(detailedResult.error instanceof ValidationError)) {
    throw new Error(`${kind} ${depth} detailed validation diverged`)
  }
  peakHeap = Math.max(peakHeap, currentHeapUsed())

  const cause = detailedResult.error.getCause()
  peakHeap = Math.max(peakHeap, currentHeapUsed())
  const path = detailedResult.error.getPath()
  peakHeap = Math.max(peakHeap, currentHeapUsed())
  const tree = detailedResult.error.getTree()
  peakHeap = Math.max(peakHeap, currentHeapUsed())
  const afterDetailedRetained = heapUsed()

  const workspaces = [fastShield.iterativeWorkspaces[0], detailedShield.iterativeWorkspaces[0]]
  const workspaceLengths = workspaces
    .filter(Boolean)
    .map((workspace) => workspace.schemas.length)
  const workspaceSlots = workspaceLengths.length > 0 ? Math.max(...workspaceLengths) : 0
  if (workspaceSlots > MAX_DEPTH + 2) {
    throw new Error(`${kind} ${depth} retained ${workspaceSlots} workspace slots`)
  }

  const result = {
    kind,
    depth,
    beforeWarmup,
    peakDuringOperation: peakHeap,
    afterWarmupRetained,
    afterDetailedRetained,
    auxiliaryBytes: Math.max(0, peakHeap - beforeWarmup),
    retainedBytes: Math.max(0, afterDetailedRetained - beforeWarmup),
    workspaceSlots,
    causeKeyword: cause.keyword,
    instancePathLength: path.instancePath.length,
    treeNodes: countTreeNodes(tree)
  }

  if (result.auxiliaryBytes > AUXILIARY_LIMIT_BYTES) {
    throw new Error(`${kind} ${depth} auxiliary memory exceeded the gate`)
  }
  if (result.retainedBytes > RETAINED_LIMIT_BYTES) {
    throw new Error(`${kind} ${depth} retained memory exceeded the gate`)
  }
  return result
}

function verifyControlledRejection(kind) {
  const testCase = createCase(kind, MAX_DEPTH + 256)
  const shield = new SchemaShield({ failFast: false, maxDepth: MAX_DEPTH })
  const validate = shield.compile(testCase.schema)
  const before = heapUsed()
  const result = validate(testCase.data)
  const after = heapUsed()
  const workspace = shield.iterativeWorkspaces[0]

  if (result.valid || result.error.code !== "MAX_DEPTH_EXCEEDED") {
    throw new Error(`${kind} did not reject maxDepth in a controlled form`)
  }
  if (workspace.schemas.length > MAX_DEPTH + 2) {
    throw new Error(`${kind} exceeded bounded workspace capacity`)
  }
  return {
    kind,
    attemptedDepth: MAX_DEPTH + 256,
    code: result.error.code,
    workspaceSlots: workspace.schemas.length,
    retainedBytes: Math.max(0, after - before)
  }
}

const measurements = []
const rejections = []
for (const kind of ["branched-object", "multi-array", "combinator", "ref"]) {
  for (const depth of [128, 384, 500]) {
    measurements.push(measure(kind, depth))
  }
  rejections.push(verifyControlledRejection(kind))
}

process.stdout.write(
  `${JSON.stringify(
    {
      runtime: `Node ${process.version}`,
      maxDepth: MAX_DEPTH,
      limits: {
        auxiliaryBytes: AUXILIARY_LIMIT_BYTES,
        retainedBytes: RETAINED_LIMIT_BYTES
      },
      measurements,
      rejections
    },
    null,
    2
  )}\n`
)
