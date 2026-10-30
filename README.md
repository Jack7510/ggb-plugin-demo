# ggb-plugin-demo

**English** | [简体中文](README.zh-CN.md)

This project records the development of a Codex/DSH plugin from an empty repository.
The host agent converts text requirements into native GeoGebra commands. A local
command-line interface (CLI) executes and verifies them, then delivers a reloadable
GeoGebra (GGB) file, reports, and screenshots. The agent uses the host's reasoning
capabilities. No additional model service or API key is required.

The standalone v2 CLI implements `doctor`, `check`, `build`, and `preview`.
Real-engine delivery evidence exists for the complete triangle case and a regular
polygon inscribed in a circle with a slider. The distributable Skill passes static
checks. The plugin is installed and enabled in local Codex. Native Skill discovery
and the installed CLI have been verified. See the [acceptance record](docs/acceptance.md)
for installation identity and results. The plugin has not been publicly published.

## Documentation and authoritative sources

| Content | Authoritative source |
| --- | --- |
| Teaching goals, scope, exclusions, A01–A12 acceptance criteria, and failure policy | [requirements.md](docs/requirements.md) |
| Component responsibilities, architecture, workflows, and runtime states | [arch.md](docs/arch.md) |
| CLI, request fields, checks and reports, delivery files, error codes, and preview protocol | [demo-contract.md](docs/demo-contract.md) |
| Execution evidence, delivery paths, and test results | [acceptance.md](docs/acceptance.md) |
| History of the fixed triangle experiment | [technical-experiment.md](docs/technical-experiment.md) |
| Recording plan and shots | [recording-script.md](docs/recording-script.md) |
| Plans for future capabilities | [capability-iteration-script.md](docs/capability-iteration-script.md) |
| Skill maintainer checks | [skill-development.md](docs/skill-development.md) |
| Skill installation, CLI resolution, and workspace output | [installation.md](skills/ggb-demo-construction/references/installation.md) |
| Codex packaging, initial setup, onboarding, and fallback entry point | [codex-installation.md](docs/codex-installation.md) |
| Skill instructions and examples | [SKILL.md](skills/ggb-demo-construction/SKILL.md) |

This README provides navigation and a current status summary. The linked documents
own the detailed rules, field definitions, and acceptance paths. Most linked
documentation is in Chinese.

## Summary video materials

The [summary video outline and narration](docs/summary-video.md) connects three
short explanations for colleagues: [Skill](docs/component-skill.md),
[tool](docs/component-tool.md), and [contract](docs/component-contract.md).
These materials summarize the current implementation for teaching. The authoritative
sources above define the detailed rules and record the evidence.

To follow one request through the code, read the
[triangle execution walkthrough](docs/triangle-execution-walkthrough.md).
It follows Codex / Skill, the request, CLI execution, verification, delivery, and preview.

## Project names

The plugin is `ggb-plugin-demo`. The Skill is `ggb-demo-construction`.
The local source is `ggb-plugin-demo-local`. The distributable Skill is at
[skills/ggb-demo-construction/SKILL.md](skills/ggb-demo-construction/SKILL.md).
Its references and examples are in the adjacent `references/` and `examples/` directories.
The DSH npm package name, account, and publication target are pending confirmation.
The `private: true` setting in `package.json` prevents accidental publication.

## Repository structure

```text
ggb-plugin-demo/
├── src/                        # CLI, requests, browser, verification, delivery, preview
├── schemas/request.schema.json # Request schema
├── examples/                   # Triangle, counterexample, and slider polygon requests
├── skills/ggb-demo-construction/ # Skill, references, installation, and examples
├── skills/setup/               # Setup Skill for this installation
├── viewer/                     # Trusted browser bridge and fixed experiment page
├── tests/                      # Node tests and real-engine integration tests
├── scripts/                    # Plugin setup, packaging, runtime/smoke, Skill checks
├── docs/                       # Requirements, architecture, contracts, acceptance, guides
├── package.json                # Private, single-package ESM project
├── plugin.json                 # Codex plugin identity, Skills, and onboarding
├── pnpm-lock.yaml              # Dependency versions and integrity lock
├── tsconfig.json               # Strict TypeScript compilation with gts
├── eslint.config.js            # Google gts and additional rules
├── runtime.lock.json           # Pinned runtime source, version, and SHA-256
├── THIRD_PARTY_NOTICES.md
├── AGENTS.md
├── README.md                   # Default English README
└── README.zh-CN.md             # Chinese README
```

`dist/` contains compiled output. `node_modules/` contains project dependencies,
and `.pnpm-store/` contains the package store. `.runtime/` contains the separately
downloaded runtime. The CLI writes `output/` in the caller's working directory,
not in the installation package. These generated directories are ignored by Git.
The viewer loads assets from the source directory; `tsc` does not copy static assets.

## Prerequisites and installation

The CLI and setup require Node.js 22+, pnpm 11.7.0, and system Chrome or Edge.
The fixed smoke command explicitly uses system Chrome. The CLI and setup share
system Chrome/Edge detection. They do not download browsers or use other clients' caches.

```sh
pnpm install --frozen-lockfile --store-dir .pnpm-store
pnpm build
pnpm setup:runtime
pnpm cli doctor
```

Local version detection on 2026-10-29 found Node.js 26.5.1, pnpm 11.7.0,
Chrome 156.0.8078.48, Codex CLI 0.165.0, and DSH 0.2.1-rc.3.
Version detection alone does not verify plugin integration or independent installation.
The minimum Node.js 22 version has not been tested separately on a real machine.

Runtime preparation requires local `curl` and `unzip`. GGB auditing also uses `unzip`.
The preparation script downloads only the pinned official runtime and license snapshots.
It does not change the global environment. See the
[installation contract](skills/ggb-demo-construction/references/installation.md)
for the complete installation layout.

Dependencies use exact versions and a lockfile. They do not use artifacts from an
adjacent template repository. Independent installation acceptance requires a new
installation root. A successful run from the development directory does not satisfy it.

See [codex-installation.md](docs/codex-installation.md) for local Codex packaging
and installation. After installation, use the packaged setup Skill or
`setup-plugin.mjs` for initial preparation. Use the same script as a fallback when
the UI entry point is unverified. Script success does not verify the UI.
The current scope permits local source installation only; public publication is excluded.

## Available commands

```sh
pnpm build
pnpm test
pnpm smoke:browser
pnpm cli --help
pnpm cli doctor
pnpm cli check --request examples/triangle.json
pnpm cli build --request examples/triangle.json
pnpm cli build --request examples/triangle-static.json
pnpm demo:counterexample
pnpm demo:drag-video
pnpm check:skill
pnpm pack:codex
# Invoke the installed copy from the user's workspace:
# node <PACKAGE_ROOT>/scripts/setup-plugin.mjs --workspace <WORKSPACE>
```

Build before invoking the CLI. See [demo-contract.md](docs/demo-contract.md) for
command behavior, request fields, delivery files, error codes, and the preview lifecycle.
See [acceptance.md](docs/acceptance.md) for recorded test results.
[skill-development.md](docs/skill-development.md) defines the static checks run by
`pnpm check:skill`.

`pnpm test` skips real-engine integration tests by default. The relevant documents
provide commands for real integration, the fixed experiment, and Skill verification.
The environment must permit Chrome to start and services to listen on loopback.

## Current limitations

- The supported scope covers the initial teaching cases for new 2D constructions.
  Editing existing GGB files, 3D, complex CAS, problem answers, and complete proofs are excluded.
- `build` commits a formal delivery only after all declared conditions, independent
  reload, each drag sample, and resource cleanup pass. Failures retain diagnostics;
  verification tolerances are not relaxed.
- The cancellation protocol, per-file runtime audit, first natural-language tasks
  in both hosts, and public publication remain incomplete or unverified.
  Local Codex installation verification and full acceptance for both hosts are recorded separately.
- Finite initial-state, reload, and interaction samples are not a general mathematical proof.
  Slider values from 3 through 12 have not all been sampled automatically.
- See [requirements.md](docs/requirements.md) for full requirements and
  [demo-contract.md](docs/demo-contract.md) for capability limits and error semantics.

## Fixed experiment and Skill

See [technical-experiment.md](docs/technical-experiment.md) for the fixed triangle
experiment's entry point, historical results, and file responsibilities.
It is a historical technical record, not the formal delivery interface.

See [SKILL.md](skills/ggb-demo-construction/SKILL.md) and
[installation.md](skills/ggb-demo-construction/references/installation.md) for the
Skill workflow, references, installation contract, and examples.
See [skill-development.md](docs/skill-development.md) for maintainer static checks
and verification through explicit Skill reading. Local Codex packaging and
installation are authorized for this phase. DSH installation and public publication are excluded.

## Coding style and comments

Owned TypeScript and JavaScript code must follow the
[Google style guide](https://google.github.io/styleguide/tsguide.html).
The project pins gts 7.0.0 for automated checks and formatting, and TypeScript 6.0.3
for compilation. Strict type checking, ESM, and browser DOM types remain enabled.

```sh
pnpm lint
pnpm fix
pnpm build
```

Lint covers owned code in `src`, `tests`, `scripts`, and `viewer`.
It requires zero errors and zero warnings. `fix` applies formatting and automatic fixes.
Code modules provide responsibility summaries. Public APIs use JSDoc.
Comments explain native fact sources, input boundaries, resource ownership,
independent reload, delivery gates, and preview shutdown decisions.
Reviewers must also check naming, readability, and comments that automated tools cannot assess.
See [AGENTS.md](AGENTS.md) for the detailed requirements.
