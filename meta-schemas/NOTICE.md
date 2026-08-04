# JSON Schema metaschema sources

The JSON files under `sources/` come from the JSON Schema specification
repository at the exact commits recorded in `manifest.json`. The generated
`lib/official-meta-schemas.json` file preserves the semantics of those resources.

Copyright belongs to the JSON Schema Specification Authors and contributors.
The upstream repository states that its source material is available under the
Academic Free License 3.0 or the BSD 3-Clause License. The complete upstream
license text is preserved in `LICENSE`.

`manifest.json` records each upstream path, commit, canonical URI, and SHA-256
digest. `npm run generate:metaschemas -- --check` verifies the local sources and
the generated snapshot entirely from local files.
