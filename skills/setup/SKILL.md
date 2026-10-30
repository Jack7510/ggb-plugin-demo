---
name: setup
description: Prepare or diagnose this installed ggb-plugin-demo package before first construction. Installs pinned local dependencies and the official runtime, detects system Chrome or Edge, and requires a real doctor smoke. Does not register plugins, change global dependencies, or construct a user diagram.
---

# Prepare this GeoGebra installation

Use this Skill for first-time setup or installation readiness errors.
Use the construction Skill for drawing after setup succeeds.

Resolve the package root from this loaded Skill directory (`../..`). Do not use
another checkout or client cache. Choose the user's workspace for doctor
outputs; it must exist outside the package root.

Run the packaged fallback entry, even if the host showed a setup button:

```sh
SKILL_DIR="<directory containing this SKILL.md>"
PACKAGE_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
WORKSPACE="<existing user workspace outside PACKAGE_ROOT>"
node "$PACKAGE_ROOT/scripts/setup-plugin.mjs" --workspace "$WORKSPACE"
```

The installer prepares only this package's resources. It uses the pinned pnpm,
a local store and fixed official runtime. It detects an existing system Chrome
or Edge and runs this package's real doctor. Do not install a global package
manager, browser, or model service when a prerequisite is missing.

Read the JSON result and process exit code. Readiness requires `ok=true`,
`status=ready`, a real doctor result and successful resource cleanup.
A successful dependency download alone is insufficient.

If setup fails, report its stage and diagnostic path. Preserve existing
resources and failure evidence. Do not delete mismatched resources, change
locks, borrow another installation, or retry an unchanged deterministic failure.

Report separately whether the user invoked the host's onboarding UI or this
script. Script success and native Skill discovery do not prove UI visibility.
Detailed input, output and failure rules are in the
[setup contract](../../docs/codex-installation.md).
