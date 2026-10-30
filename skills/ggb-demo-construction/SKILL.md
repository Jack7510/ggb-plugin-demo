---
name: ggb-demo-construction
description: Use when the user asks for a new 2D GeoGebra construction from text or a diagram description. Supports native command requests, sliders and parameterized constructions, per-condition checks, real mouse drag samples, independent reload, and delivery of a GGB file with verification artifacts. Does not provide answers or proofs, and does not claim image understanding or host installation.
---

# GeoGebra Construction Skill

## Scope

Use this skill only for a new two-dimensional construction. The host model turns the user's text or image into conditions, native GeoGebra commands and a verification request. The local CLI executes that request, collects native facts and returns a verified GGB or a diagnostic failure.

Do not use it for editing an existing GGB, 3D, complex CAS, answers, or full proofs. If the input is an image, the host is responsible for reading it. The local tool does not inspect images and does not claim visual understanding.

Ask only for missing information that changes the construction. Never silently add a mathematical condition or a coordinate that the user did not give. Treat the agent's checklist as a proposal until the user and the engine evidence agree.

## Workflow

### 1. Extract conditions and choices

- Restate the required objects, relations, styles, labels and interactions in plain language.
- List every condition that must be verified. Keep them in the request even if a first attempt fails.
- Separate given conditions from demonstration choices. Initial coordinates and other conveniences belong in `choices`, not in the user's conditions.
- State that finite samples are not a general proof and that no answer or proof is being produced.

### 2. Locate this installation from the skill path

Set `SKILL_DIR` to the directory that contains this loaded `SKILL.md`. Do not use a developer-machine path and do not search other plugin caches.

Follow [installation and CLI resolution](references/installation.md) to set
`CLI`, `PACKAGE_ROOT` and `WORKSPACE`. That reference defines the required
package resources and both CLI layouts. Keep an explicit `GGB_CLI` when supplied.
Run the CLI from the user's workspace:

```sh
(cd "$WORKSPACE" && node "$CLI" --version)
(cd "$WORKSPACE" && node "$CLI" doctor)
```

Require `doctor` to succeed. Its `runtime-readiness` result only proves that this installation can load the fixed runtime; it does not prove the geometry. If the CLI or runtime is missing, stop and report the resolved paths. Do not fall back to another checkout, a global install, or a client cache. The supported bundled and host-provided layouts are documented in [installation](references/installation.md).

### 3. Write the native request

Use [request fields and CLI](references/request-and-cli.md) and the package [request schema](../../schemas/request.schema.json). Keep mathematical semantics in GeoGebra native commands.

- Every required output label needs a program step and an object check.
- Every requirement needs a check, a style, or an interaction that covers it.
- Use native boolean probes for relations; do not replace them with model text.
- Declare every interaction. If dragging is required, provide a real drag sample; do not hide it with an empty list.
- Use only the fixed coordinate tolerance from the contract. Never widen it to make a result pass.
- When a quantity is meant to vary, prefer a native GeoGebra slider over a hard-coded constant. A common case is the number of sides of a regular polygon. Declare the slider as a numeric program label with `Slider(min,max,increment,...)`, derive dependent objects from it, and add object and range checks. State the chosen range and initial value as construction choices. A slider is a control and a declared dependency, not proof that every value was tested.

The concrete triangle recipe in [the triangle example](examples/triangle.md) and the slider-based polygon recipe in [the circle/polygon example](examples/circle-inscribed-polygon.md) are illustrations, not general templates. Do not copy their coordinates or commands into a different problem.

### 4. Preflight with check

Run:

```sh
(cd "$WORKSPACE" && node "$CLI" check --request <request.json>)
```

`check` validates structure, references and coverage only. It does not start GeoGebra and does not prove the mathematics. If it fails, fix the request and run it again before building. Keep the original user requirements and the failed request.

### 5. Build with the real engine

Run:

```sh
(cd "$WORKSPACE" && node "$CLI" build --request <request.json>)
```

Read stdout and stderr as JSON. A successful result is only the delivery path returned by `build`; a failure has no successful delivery. Do not infer success from exit code alone, a screenshot, or text written by the model.

### 6. Read the complete report

Read the full `verification.json` using [report reading](references/report-reading.md). Check each phase and actual fact:

- initial and independently reloaded reports;
- the `requirements` summary;
- every interaction sample, including before/after positions, target error, native parents and screenshots;
- the cleanup record.

An unverified or failed condition blocks delivery. A static coordinate that happens to equal the expected value does not replace a native dependency.

### 7. Deliver and open the interactive GGB

On success, report the absolute delivery directory and its main artifacts, especially `construction.ggb`, `verification.json`, `preview.png`, `request.json` and `manifest.json`. `build` writes under `$WORKSPACE/output`; never write deliverables or diagnostics into the package installation.

Then run:

```sh
(cd "$WORKSPACE" && node "$CLI" preview --delivery <delivery-path>)
```

This is the required final handoff: Playwright opens this package's selected system browser (Chrome, or Edge when Chrome is absent) and loads exactly the delivered GGB bytes. Keep the window open so the user can drag and inspect the construction. Do not replace it with a screenshot or a re-drawn figure. After the user closes the window or interrupts the process, require the `closed` event, exit code 0 and a cleanup record showing the browser and server are gone. If preview fails, report it separately and keep the delivery unchanged.

## Failure and repair limit

- Preserve the original request, failed output, `failure.json`, diagnostics directory and original requirements. Never overwrite old failure evidence.
- After a failed build, at most two automatic repair attempts are allowed. Each attempt is a new request and a new run. Never reuse a failed delivery or edit the old diagnostics.
- Do not remove conditions, remove checks, change the requested geometry, or loosen the fixed coordinate tolerance to get a pass. If a condition cannot be verified, mark it unverified and stop.
- After two failed repair attempts, report the blocking condition, the unmet requirements and the diagnostic paths. Do not claim success.

## Boundaries

- Analysis and construction only. Do not provide an answer, a proof, or a claim of general mathematical validity.
- Do not register a plugin, install into a host, or publish this skill. Those steps require separate authorization and evidence.
- Do not search other skill stores, plugin caches or development checkouts.
- Do not claim that the local tool understands images. The host handles image input.
- Finite initial, reload and drag samples are not a general proof.
