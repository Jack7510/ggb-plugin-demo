# Installation, CLI Resolution and Workspace Output

This Skill is not a standalone JavaScript program. It needs the matching
GeoGebra CLI, viewer, runtime and request schema. There are two supported
layouts.

## A. Bundled package layout

The skill lives inside the same installed package as the CLI:

```text
<PACKAGE_ROOT>/
├── skills/ggb-demo-construction/
├── dist/src/                   # cli.js and all imported compiled modules
├── node_modules/               # matching runtime dependencies
├── package.json
├── pnpm-lock.yaml
├── runtime.lock.json
├── THIRD_PARTY_NOTICES.md
├── viewer/
├── schemas/
├── docs/
├── examples/
├── .runtime/                   # extracted official bundle and receipt.json
└── .runtime-download/
    ├── geogebra.zip            # rehashed on every doctor/build/preview
    └── geogebra-license.html   # official license snapshot
```

The installed dependencies must resolve within this package. Keep their
package-manager layout intact. Do not link dependencies to another checkout
or client cache. The archive and license snapshot are runtime inputs, not
optional installer leftovers.

The installer must prepare these resources before it makes the package
read-only. See the package [environment and setup instructions](../../../README.md#环境与安装).
A source-based preparation also needs `src/`, `scripts/setup_runtime.mjs` and
`tsconfig.json`. Runtime use needs the complete compiled `dist/src/` tree;
copying only `cli.js` is insufficient. This layout is a required resource
contract. See the package [Codex installation procedure](../../../docs/codex-installation.md)
and [acceptance record](../../../docs/acceptance.md) for the scope actually verified.
This layout alone does not prove independent installation or host discovery.

## B. Host-provided CLI

A host or installer may provide an explicit absolute `GGB_CLI`.
That CLI must have the same resource layout at its own package root.
Do not mix a Skill with a different CLI version.

## Resolve once for either layout

Set `SKILL_DIR` from the loaded `SKILL.md`. Set `WORKSPACE` to the user's
working directory. Run this procedure in one shell session:

```sh
SKILL_DIR="<directory containing SKILL.md>"
WORKSPACE="<user workspace>"
SKILL_PACKAGE_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
CLI="${GGB_CLI:-$SKILL_PACKAGE_ROOT/dist/src/cli.js}"
case "$CLI" in
  /*) ;;
  *) printf '%s\n' 'CLI must be an absolute path' >&2; exit 1 ;;
esac
test -f "$CLI" || exit 1
PACKAGE_ROOT="$(cd "$(dirname "$CLI")/../.." && pwd)"
(cd "$WORKSPACE" && node "$CLI" --version)
(cd "$WORKSPACE" && node "$CLI" doctor)
```

`SKILL_PACKAGE_ROOT` locates the loaded Skill. `PACKAGE_ROOT` locates the chosen
CLI and its resources. They can differ only when the installer supplies a
matching `GGB_CLI`. Request references must keep these resolved values.
Do not search other checkouts or client caches when a resource is missing.

## Workspace output

`build`, `doctor` and `preview` write under the **caller's working directory**,
not under the installed package. Use the user's workspace as `WORKSPACE`:

```sh
WORKSPACE="<user workspace>"
(cd "$WORKSPACE" && node "$CLI" doctor)
(cd "$WORKSPACE" && node "$CLI" build --request /absolute/request.json)
(cd "$WORKSPACE" && node "$CLI" preview --delivery /absolute/delivery)
```

Deliveries are under `$WORKSPACE/output/delivery-*`, diagnostics under
`$WORKSPACE/output/.build-*` and `$WORKSPACE/output/preview-*`. This must also
hold when the package directory is read-only. If an older CLI still writes to
the package root, stop and report the mismatch; do not use it for user work.

## First-time preparation

Use the package setup Skill or run the packaged `scripts/setup-plugin.mjs`
with the user workspace. The [setup contract](../../../docs/codex-installation.md)
is the single source for that procedure and its failure semantics.
Do not run a developer checkout to prepare an installed copy.

## Prerequisites and readiness

- Node.js 22 or newer (the host must not substitute an Electron binary).
- The package's pinned GeoGebra runtime, prepared by the package's documented
  setup step.
- A system Google Chrome or Microsoft Edge for the headless and visible Playwright checks.
- `node "$CLI" --version` and `node "$CLI" doctor` both succeed.
- The request schema and CLI contract version match the CLI; a request is
  `schemaVersion: 2` in this package.

`doctor` proves runtime readiness only. It does not prove a construction.

## Distribution rules

- Ship the CLI, viewer, runtime, schema, docs and examples together, or provide
  a matching `GGB_CLI` installation. Do not ship only `SKILL.md`.
- Do not include developer-only checks or test harnesses as user instructions.
  Maintainer steps live in the package's `docs/skill-development.md`.
- Do not place developer-machine absolute paths in `SKILL.md`, references or
  examples. The `GGB_CLI` value is supplied at use time, not written into the
  skill.
- Do not claim auto-discovery, registration or independent installation based
  on a successful local read. Those require separate install evidence.
