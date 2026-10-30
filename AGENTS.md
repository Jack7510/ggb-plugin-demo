# Repository Guidelines

## Project Structure & Module Organization

This repository implements a request-driven TypeScript ESM CLI: doctor, check, build, preview, and a fixed GeoGebra regression experiment. src/ contains request validation, runtime, server, browser, verification and pipeline modules; schemas/ defines the request; examples/ contains the triangle input; skills/ggb-demo-construction/ contains the distributable skill and its references/examples; viewer/ contains the trusted browser bridge; tests/ contains unit and opt-in real-engine integration tests. Local Codex packaging and installation are in scope; DSH integration is not implemented.

Use `docs/` for project documentation. Read docs/requirements.md for scope and acceptance gates; README.md describes the current directory structure and command availability. Recording scripts describe future work, not implemented behavior. When adding the first implementation, document its entry points, source directories, test locations, and asset paths in README.md. Keep generated output separate from source files.

## Build, Test, and Development Commands

Use Node.js 22+ and pnpm 11.7.0. Commands: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm check:skill`, and `pnpm smoke:browser`. Build before running `pnpm cli`. `pnpm test` skips real-engine integration by default; run `GGB_INTEGRATION=1 node --test dist/tests/integration.test.js` explicitly for it. Browser/service checks need permission to launch Chrome and listen on loopback. Run `pnpm lint` for the Google gts rules and formatting gate; use `pnpm fix` for automatic fixes. Both cover src/, tests/, scripts/ and viewer JavaScript.

Use these Git commands to review contributions:

- `git status --short`: list new and changed files.
- `git diff`: inspect unstaged changes to tracked files.
- `git diff --check`: detect whitespace errors in tracked changes.

When introducing a toolchain, add reproducible setup instructions and the exact commands required to run and validate the project.

## Coding Style & Naming Conventions

Before editing, read the relevant files, check the actual working directory and Git status, and preserve existing documents and uncommitted changes. Inspect dependencies first, group related edits, and validate after a coherent batch. Do not overwrite unrelated work or refactor outside the task.

For Markdown, use descriptive headings, short paragraphs, and fenced code blocks with language identifiers. Use relative links for repository files. Prefer lowercase, hyphen-separated documentation filenames, such as `docs/local-setup.md`.

Give each question, contract, workflow rule or acceptance result one authoritative document. Explain it fully there; other documents must link to that source with a short pointer instead of repeating the same explanation. If the same fact appears in a README, a Skill and a contract, choose one canonical location and keep the other mentions minimal and clearly derived from it.

Follow the [Google TypeScript / JavaScript Style Guide](https://google.github.io/styleguide/tsguide.html) strictly for all owned TypeScript and JavaScript code. Use pinned gts 7.0.0 for lint and formatting, and TypeScript 6.0.3 for compatibility with its parser. Inherit gts compiler defaults while preserving this project's ESM target, strict options and browser DOM types.

- Keep `scripts/setup-plugin.mjs` as the user-requested stable installer entry; its internal modules use lower_snake_case. Use lower_snake_case for other owned source filenames; keep standard tool filenames and versioned JSON/artifact names stable. Markdown documentation keeps the repository's hyphen-separated names.
- Use two-space indentation, single quotes, semicolons, braces for all control-flow bodies, and gts formatting. Use descriptive camelCase names; preserve third-party API names and versioned wire-field names.
- Prefer named function declarations for named functions, const for stable bindings, readonly for stable fields, and explicit types at external boundaries. Do not introduce any, type suppressions or double assertions to bypass checks. Runtime-validated or third-party bridge assertions must have an obvious or documented reason.
- Add a concise file overview to execution modules and JSDoc to exported APIs. Explain purpose, preconditions, data provenance, ownership, non-obvious decisions, failure behavior and cleanup invariants where needed. Comments may be Chinese to help the intended readers; identifiers remain consistent with the code and contracts.
- Explain why rather than repeat what each line does. Keep comments synchronized with behavior. Avoid placeholder comments, misleading guarantees, decorative section banners and commented-out code. An intentionally empty catch must explain why the error is expected and safe to ignore.
- Do not disable lint rules to pass a check. Fix the code; if a real platform constraint requires an exception, document its concrete reason and review it explicitly. Formatting and lint cover mechanical rules only; reviewers must also check naming, API boundaries, comments and other guide requirements.

Keep changes focused and preserve existing user work. A style task can format the affected owned source tree; feature tasks must avoid unrelated formatting.

Prefer the simplest implementation that satisfies the requirements. Do not add unnecessary frameworks or abstractions. Keep mathematical semantics in GeoGebra native commands. Do not add problem-keyword routing, a second mathematical language, or model-declared verification success. Enforce executable acceptance gates in the local tool.

The current task authorizes a standalone v2 CLI, formal delivery for requests whose declared requirements are all verified, and same-file preview. Keep the fixed experiment as a regression case. Real mouse drag verification is implemented for declared independent points: each sample must reload the disk GGB into a new empty applet, use real mouse input, and pass hit, displacement, dependency and screenshot checks or fail closed. Keep the full triangle case and a separate explicitly static technical subcase; never drop the full case requirements to claim success. Do not add problem routing or publish. The current user explicitly authorizes packaging and local Codex installation under ggb-plugin-demo-local; preserve other installed plugins and prepare dependencies/runtime inside this installation. DSH installation remains outside scope. The skill under skills/ggb-demo-construction/ is packaged with the CLI; report host discovery and installation only when supported by recorded evidence. Use `pnpm setup:runtime` to prepare the runtime and `pnpm experiment:triangle` for the fixed regression.

## Review Rules

- Enforce the Google style guide and clear comments. Require `pnpm lint` to pass with zero warnings; reject unexplained suppressions and comments that contradict code.
- Review against docs/requirements.md and the current task. Separate implemented behavior, proposed design, and unverified claims.
- Check correctness, failure paths, dynamic dependencies, artifact identity, independent reload, resource cleanup, and installation isolation when affected.
- Reject success claims based only on model text, screenshots, stale output, or incomplete checks. Required conditions that fail or remain unverified must block formal delivery.
- Check that installation evidence does not borrow template-repository artifacts or other client caches.
- Confirm that changes preserve existing user work, use the teaching names consistently, and do not expose credentials or private configuration.
- Report actionable findings with file locations, impact, and supporting evidence. State checks that could not run and remaining risks.

## Testing Guidelines

Tests use the built-in Node.js test runner; no coverage target is configured. Documentation changes require checking paths, links, command examples, and consistency between diagrams, contracts, and acceptance criteria. Git diff checks do not cover untracked files; inspect those separately.

For code contributions, include verification appropriate to the behavior and document how to run it. Run targeted checks after a coherent batch; use broader checks when the risk or repository rules justify them. Do not rerun successful checks without relevant changes. Do not add empty tests or tests that only mirror trivial implementation details.

Real GeoGebra construction, independent reload, and applicable mouse interaction require engine evidence. Include valid examples and meaningful incorrect variants for affected delivery gates. Never weaken expected conditions or tolerances just to pass a test. Record checks that could not run and explain why. Never claim a check passed unless it actually ran successfully.

## Commit & Pull Request Guidelines

Use concise, imperative commit subjects, such as `Add local setup guide`.

Pull requests should describe the purpose, changed behavior, and validation performed. Link relevant issues when available. Include screenshots for visible interface changes. Keep each contribution limited to one coherent task.

## Security & Configuration

Do not commit credentials, access tokens, or private configuration. When adding configuration, provide examples with placeholder values and document required environment variables.
