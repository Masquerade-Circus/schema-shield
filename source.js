/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");
const { hrtime } = require("process");

const outdir = path.join(__dirname, "dist");
const entryPoint = path.join(__dirname, "lib", "index.ts");
const sizeReportArtifacts = [
  "index.mjs",
  "index.js",
  "index.min.js",
  "index.min.js.map",
  "index.d.ts"
];

function convertToUMD(text, globalName) {
  // HACK: convert to UMD - only supports cjs and global var
  const varName = "__EXPORTS__";
  let code = text;

  code = code.replace(/export\s*\{([^{}]+)\}/, (_, inner) => {
    const defaultExport = inner.match(/^(\w+) as default$/);
    return defaultExport != null
      ? `var ${varName}=${defaultExport[1]}`
      : `var ${varName}={${inner.replace(/(\w+) as (\w+)/g, "$2:$1")}}`;
  });

  code = code.replace(/export\s*default\s*(\w+)/, (_, name) => {
    return `var ${varName}=${name}`;
  });

  code = code.replace(/module.exports\s*=\s*(\w+)/, (_, name) => {
    return `var ${varName}=${name}`;
  });

  if (code.includes("__EXPORTS__")) {
    code = `(()=>{${code};typeof module!=='undefined'?module.exports=${varName}:self.${globalName}=${varName}})()`;
  }
  return code;
}

function emitDeclarations() {
  const tscBin = path.join(
    __dirname,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc"
  );
  const result = spawnSync(
    tscBin,
    [
      "--project",
      "tsconfig.json",
      "--declaration",
      "--declarationMap",
      "--emitDeclarationOnly",
      "--outDir",
      outdir,
      "--skipLibCheck"
    ],
    {
      cwd: __dirname,
      stdio: "inherit"
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `tsc declaration emit failed with exit code ${result.status}`
    );
  }
}

async function buildWithBun(outfile, options) {
  const result = await Bun.build({
    entrypoints: [options.entrypoint ?? entryPoint],
    outdir: path.dirname(outfile),
    naming: path.basename(outfile),
    target: options.target ?? "node",
    format: options.format,
    minify: options.minify ?? false,
    bundle: options.bundle ?? true,
    sourcemap: "external"
  });

  if (!result.success) {
    throw new AggregateError(result.logs, `Bun build failed for ${outfile}`);
  }

  for (const output of result.outputs) {
    fs.mkdirSync(path.dirname(output.path), { recursive: true });
    fs.writeFileSync(output.path, Buffer.from(await output.arrayBuffer()));
  }

  return result;
}

function finalizeBrowserGlobalArtifact(outfile) {
  const code = fs.readFileSync(outfile, "utf8");
  const browserCode = code.replace(
    /export\s+default\s+([A-Za-z_$][\w$]*)\(\);?\s*(\/\/#[^\n]+)?\s*$/,
    (_, factoryName, sourceMapComment = "") =>
      `self.SchemaShield=${factoryName}();${sourceMapComment}`
  );

  if (browserCode === code) {
    return;
  }

  fs.writeFileSync(outfile, browserCode);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)}kb`;
}

function printSizeReport() {
  console.log("\nSize report (dist)");
  console.log("Artifact             raw       gzip       br");

  for (const artifact of sizeReportArtifacts) {
    const distFile = path.join(outdir, artifact);

    if (!fs.existsSync(distFile)) {
      console.log(`${artifact.padEnd(17)} missing`);
      continue;
    }

    const buffer = fs.readFileSync(distFile);

    const dist = {
      raw: buffer.length,
      gzip: zlib.gzipSync(buffer).length,
      brotli: zlib.brotliCompressSync(buffer).length
    };

    console.log(
      `${artifact.padEnd(17)} ${formatBytes(dist.raw).padStart(8)} ${formatBytes(dist.gzip).padStart(10)} ${formatBytes(dist.brotli).padStart(8)}`
    );
  }
}

async function build() {
  try {
    if (typeof Bun === "undefined") {
      throw new Error(
        "source.js must be run with Bun, for example: bun source.js"
      );
    }

    const buildStart = hrtime();

    fs.rmSync(outdir, { recursive: true, force: true });
    fs.mkdirSync(outdir, { recursive: true });

    emitDeclarations();

    await buildWithBun(path.join(outdir, "index.mjs"), { format: "esm" });
    await buildWithBun(path.join(outdir, "index.js"), { format: "cjs" });

    const browser = await buildWithBun(path.join(outdir, "index.browser.mjs"), {
      format: "esm",
      target: "browser"
    });
    const browserOutput = browser.outputs.find(
      (file) => !file.path.endsWith(".map")
    );

    if (!browserOutput) {
      throw new Error("Bun browser output was not found");
    }

    const browserUmd = path.join(outdir, "index.browser.umd.js");
    fs.writeFileSync(
      browserUmd,
      convertToUMD(await browserOutput.text(), "SchemaShield")
    );

    await buildWithBun(path.join(outdir, "index.min.js"), {
      entrypoint: browserUmd,
      format: "esm",
      target: "browser",
      minify: true,
      bundle: false
    });

    finalizeBrowserGlobalArtifact(path.join(outdir, "index.min.js"));

    fs.rmSync(browserUmd, { force: true });
    fs.rmSync(path.join(outdir, "index.browser.mjs"), { force: true });
    fs.rmSync(path.join(outdir, "index.browser.mjs.map"), { force: true });

    printSizeReport();

    const buildEnd = hrtime(buildStart);
    console.log(
      `Build time: ${(buildEnd[0] + buildEnd[1] / 1e9).toFixed(2)} seconds`
    );
  } catch (error) {
    console.log("Build failed with error:", error);
    process.exitCode = 1;
  }
}

build();
