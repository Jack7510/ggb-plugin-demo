# Skill Development and Manual Validation

This is a maintainer document. It is not part of the user-facing construction
flow and should not be presented as an installed-Skill readiness claim.

## Static package check

From the package root:

```sh
pnpm check:skill
```

The command checks the Skill frontmatter, package-relative references and the
default CLI path computed from the skill directory. It also executes the
resolved CLI `--version`. It does not prove host discovery or an independent
installation.

It also checks the packaged setup Skill, installer entry and compiled setup
module, and the manifest's onboarding path. Setup behavior and UI verification
remain separate checks under the [setup contract](codex-installation.md).

## Read the package skill directly

Read the Skill from the package, not from another cache. Resolve `CLI` and
`WORKSPACE` exactly as described in
[installation.md](../skills/ggb-demo-construction/references/installation.md);
do not invent a second layout or search another checkout. Confirm that the
frontmatter name is `ggb-demo-construction`, all references exist, and the
description does not claim image understanding, answers, proofs or host
installation.

## Session identity and runtime

```sh
(cd "$WORKSPACE" && node "$CLI" --version)
(cd "$WORKSPACE" && node "$CLI" doctor)
```

Record the resolved Skill path, package root, CLI path/version, runtime version
and doctor diagnostics. `doctor` must succeed and its cleanup must show the
browser and server gone. Doctor success is runtime readiness only.

## Workspace output

The canonical output rule is in
[installation.md](../skills/ggb-demo-construction/references/installation.md).
Verify it with a check/build from `$WORKSPACE`:

```sh
(cd "$WORKSPACE" && node "$CLI" check --request /absolute/request.json)
(cd "$WORKSPACE" && node "$CLI" build --request /absolute/request.json)
```

The returned delivery path must start with `$WORKSPACE/output`. The integration
suite also records the package `output/` entries before and after a run and
asserts that no new entry appears there.

## Positive flow

Use the package examples or a request you wrote from the user's conditions.
Read the full `verification.json`, not only the `ok` field:

- initial and reloaded checks;
- requirements and evidence;
- interaction samples and screenshots;
- slider facts (`actual.slider`) when a slider is declared;
- cleanup and blocked requests.

Then run preview from the workspace and keep the visible window open for the
user. Closing it should produce `closed`, exit code 0 and a preview cleanup
record. A preview failure is reported separately and does not change the
delivery.

## Negative flow

Build a test-only static-midpoint variant from the package examples. It must
fail with `VERIFICATION_FAILED`, keep its diagnostics and produce no delivery
manifest. Do not delete the failure or add it to a positive delivery.

## What this proves

This proves only that a maintainer can read the package Skill, resolve its CLI
and run the documented flow against the local checkout or a matching installed
copy. It does not prove:

- host auto-discovery;
- plugin registration;
- installation into Codex or DSH;
- independent installation without the development checkout;
- a general proof for all constructions.

Those require separate, explicitly authorized checks. Do not register, install
or publish as part of this validation.
