# Official JSON Schema metaschemas

SchemaShield vendors 19 JSON resources from the official
`json-schema-org/json-schema-spec` repository. The normal build verifies these
local files against `manifest.json` and generates
`lib/official-meta-schemas.json` deterministically.

| Dialect | Upstream commit |
| --- | --- |
| draft-04 | `dba92b702c94858162f653590230e7573c8b7dd0` |
| draft-06 | `59ed5f6fc6f6386e23ca51d7f31d7fe9cf696713` |
| draft-07 | `567f768506aaa33a38e552c85bf0586029ef1b32` |
| 2019-09 | `41014ea723120ce70b314d72f863c6929d9f3cfd` |
| 2020-12 | `769daad75a9553562333a8937a187741cb708c72` |

The built-in 2020-12 catalog contains the vocabularies implemented by
SchemaShield, including the optional `format-assertion` metaschema. The general
2020-12 metaschema keeps `format-annotation` as its declared format vocabulary.

## Maintainer commands

`npm run generate:metaschemas` verifies hashes and regenerates the snapshot from
local files. Add `-- --check` to run a read-only verification of the committed
snapshot.

`npm run update:metaschemas` performs the explicit network update. It downloads
the paths and commits declared in `manifest.json`, validates each canonical
identity, rewrites the SHA-256 digests, preserves the upstream license, and then
regenerates the snapshot. The resulting source and manifest diffs provide the
review record for each update.

## Source fidelity

The pinned official files preserve these schema constraints:

- The draft-06 metaschema constrains each `patternProperties` key with
  `propertyNames: { "format": "regex" }`.
- The draft-07 metaschema defines `writeOnly` as a boolean with a default of
  `false`.

The 2019-09 and 2020-12 catalogs preserve their complete implemented resource
graphs. Draft-04 uses the same pinned source and deterministic generation path
as every other built-in dialect.
