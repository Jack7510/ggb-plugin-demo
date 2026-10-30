# Reading the Verification Report

A successful `build` returns a delivery directory. Do not stop at the JSON `ok` flag. Read these files and compare the original requirements with the recorded facts.

## What to open

```text
<delivery>/
├── request.json
├── verification.json
├── manifest.json
├── cleanup.json
├── constructed.json
├── reloaded.json
├── interaction-<id>-before.json
├── interaction-<id>-after.json
└── interaction-<id>-before/after.png
```

## verification.json

Check the top-level fields in this order:

1. `scope` is `declared-request` and `status` is `passed`.
2. `contentEqual` is `true`.
3. `requirements` has one entry per declared requirement and every `status` is `passed`.
4. `reports` contains both `initial` and `reloaded` phases, and each `ok` is true.
5. `interactions` matches the number of declared samples, and every sample `status` is `passed`.
6. `mouseInteraction` is `verified` when interactions were declared, or `not-requested` when none were.
7. `limitations` is read as a scope limit, not as a pass condition.

The check entries contain `id`, `requirement`, `expected`, `actual` and `status`. Inspect `actual` rather than trusting `passed`:

- `exists` and `defined` are true;
- `type` matches the intended native type;
- `parents` are the native algorithm inputs in order;
- `independent` agrees with the parent list;
- point `coordinates` match the fixed `1e-9` tolerance;
- boolean probes have `type === "boolean"` and numeric value `1`;
- style entries show the actual color and `labelVisible`/`labelStyle`;
- if `actual.slider` is present, its min, max, width, horizontal and showAlgebra values are the native slider settings, not proof that every slider position was executed.

### Initial and reloaded

`initial` is the construction in the original applet. `reloaded` is the same GGB read from disk and loaded into a new empty applet after the original context is closed. Both must pass. The reload comparison must cover object content, native parents, style and scripts, not just a screenshot.

### Requirements

Each entry has an id, description, status and evidence map. `evidence.initial`, `evidence.reloaded` and `evidence.interactions` identify the checks that support it. A requirement with no evidence is `unverified`; it cannot be reported as passed. A failed sample makes its requirement fail even if another phase passed.

## Interaction samples

Each sample records:

- `source`: the disk GGB file, its SHA-256, the empty-applet object count and whether the loaded facts matched the verified reload;
- `pointer`: the actual start and target pixels, mouse down/up, step count, hit radius and nearby point candidates;
- `expected`: the declared `from`, `to` and sampled check ids;
- `before` and `after`: the declared point's native summary;
- `displacement`: world and pixel movement plus distance;
- `targetError`: world and pixel difference from the declared target;
- `checks`: the explicitly sampled checks;
- `invariants`: all declared checks with coordinate expectations removed for the moved phase, including native parent and boolean checks;
- `styles`: the declared color/label checks after the drag;
- `unchangedIndependentPoints`: independent points that must not move;
- `allDefined`, `unsupported`, `objectLabelsEqual`, `reasons` and screenshots.

A passing sample has `reasons: []`, the declared point moved, target error within the fixed per-axis pixel tolerance, all sampled checks and invariants passed, all styles passed, and no other independent point moved. An ambiguous hit, unchanged point, failed relation, missing screenshot or inconsistent source blocks the sample.

## Supporting records

- `constructed.json` and `reloaded.json` are the full native facts used for the phase checks.
- `constructed.xml`, `reloaded.xml` and other XML files preserve the engine serialization.
- `runtime.json` identifies the fixed runtime; `environment.json` records the browser and Node version.
- `requests.json` lists local resource requests and blocked requests; `blocked` must be empty.
- `browser-log.json` preserves console and page errors.
- `cleanup.json` must have `ok: true`, `browserDisconnected: true`, `serverStopped: true`, and page/context/browser/server all closed or not created.
- `manifest.json` records the output labels, request hash, runtime identity and every other file hash. It does not contain its own hash.

## Failure records

A failed run has no successful delivery path. Open `failure.json`, the diagnostics directory, the request copy, stderr JSON and any available failure screenshot. Keep the original requirements and do not edit the old failure directory. A missing or unreadable diagnostic is itself a reason to stop, not a reason to retry with weaker checks.

## Preview

`preview` first revalidates the delivery and the GGB hash, then opens the same bytes in a visible Playwright window in the selected system Chrome/Edge. Treat `ready` as “the window is interactive”, not as “resources exited”. After the user closes the window or interrupts, require the `closed` event, exit code 0 and a cleanup record with no browser or server left. A preview failure is reported separately; it never changes the delivered GGB or report.

Finite initial, reload and drag samples are evidence for this declared request only. They are not a proof for every configuration or every geometry problem.
