# Request Fields and CLI Invocation

This is the working reference for this skill. The canonical sources are the package [CLI and request contract](../../../docs/demo-contract.md) and [request schema](../../../schemas/request.schema.json). If this reference and the canonical files disagree, stop and report the mismatch; do not guess. The package's `src/` tree is not required at use time.

## Locating the package

Use [installation and CLI resolution](installation.md) to set `CLI`,
`PACKAGE_ROOT` and `WORKSPACE`. That procedure supports both the bundled CLI
and an explicit absolute `GGB_CLI`. Do not reset `CLI` in this reference.
The matching schema is `$PACKAGE_ROOT/schemas/request.schema.json`.
Record identity from the user's workspace:

```sh
(cd "$WORKSPACE" && node "$CLI" --version)
(cd "$WORKSPACE" && node "$CLI" doctor)
```

`doctor` must return `scope=runtime-readiness` and a cleanup record. It proves the fixed runtime is usable, not that a construction is correct.

Do not search Codex or DSH plugin/skill caches, sibling repositories, global installs, or any other client cache.

## Request fields

The request is JSON, at most 1 MiB, with `schemaVersion: 2`.

| Field | Required | Meaning |
| --- | --- | --- |
| `schemaVersion` | yes | Fixed value `2`. |
| `title` | yes | Data label only; it is not used for routing or file paths. |
| `source` | yes | The original task text, kept for traceability. It does not prove the extraction is complete. |
| `choices` | yes | Demonstration choices, including initial coordinates. Do not put user conditions here. |
| `requirements` | yes | `{id, description}` list. Every requirement must be covered by a check, style, or interaction. |
| `program` | yes | Ordered `{label, expression}` native commands. Every label is unique. |
| `outputs` | yes | Labels that must be delivered. Each needs a program step and an object check. |
| `styles` | yes | `{label, requirement, color?, labelVisible?}`; at least one display property is required. |
| `checks` | yes | Object or boolean checks, each with a unique id tied to a declared requirement. |
| `interactions` | yes | Drag samples. Use `[]` only when no interaction is required. |
| `view` | yes | `[xmin, xmax, ymin, ymax]`; display only. |

Labels and ids are ASCII-letter-first, then letters, digits or underscores, at most 40 characters. The `ggbCheck` prefix is reserved. The full limits, evidence filenames and rejection rules are in the canonical contract. Underscores in interaction ids are preserved in evidence filenames.

### Program and native syntax

- Use GeoGebra native syntax and native commands. Do not add a second mathematical language.
- The tool creates the assignment; an expression must not contain another assignment or command separator.
- Strings, backslashes, comments, URLs and user JavaScript are rejected.
- Side-effecting commands such as `Set*`, `Execute`, `Run*Script`, `Delete`, `Rename`, `Zoom*`, `Pan`, `Show*`, `Hide*` and import/export commands are rejected.
- Labels are case-sensitive in the engine. Do not rename a user-visible object just to make the request easier.

### Variable quantities and sliders

When a quantity is meant to vary, use a native slider instead of a hard-coded constant. A typical case is the number of sides of a regular polygon:

```text
n=Slider(3,12,1,1,200,false,true,false,false)
B=Rotate(A, 2*pi/n, O)
poly=Polygon(A,B,n)
```

The `Slider(min,max,increment,speed,width,isAngle,horizontal,animating,random)` command creates a numeric control. In the tested engine its initial value is the minimum, so choose the range with that in mind and record the range and initial value in `choices`. The slider is an independent numeric object for request checks; the current fact model exposes its actual `slider` settings (min, max, width, horizontal, showAlgebra) alongside the numeric value. The CLI cannot prove that every slider position was executed; the report's `slider` fact covers the control settings, not a sweep of all values.

Derive dependent objects from the slider label instead of recomputing with a fixed value. Do not use `SetValue`, `SetCoords`, or another assignment to move the control. In preview the user can move the slider; that interaction is not automatically part of the headless delivery gate. State this finite-sampling boundary in the report.

### Checks

Object check:

```json
{"id":"derivedCheck","requirement":"geometry","kind":"object","label":"S","type":"point","parents":["Q","R"]}
```

Boolean check:

```json
{"id":"relation","requirement":"geometry","kind":"boolean","expression":"AreEqual(S,Midpoint(Q,R))"}
```

The engine facts, not the model text, decide the result. `parents` are the native algorithm inputs, and `independent` must match whether the parent list is empty. Coordinates use a fixed absolute tolerance of `1e-9`; never propose a larger tolerance. A boolean probe must be an actual native boolean with value 1.

### Styles

Use an uppercase `#RRGGBB` color and/or `labelVisible`. A style target must be a declared program label. Text labels and name display are checked from engine facts.

### Interactions

```json
{"id":"dragP","requirement":"dragP","kind":"drag","label":"P","from":[1,2],"to":[3,4],"checks":["relation"]}
```

The label must be an independent point. `from` and `to` are finite world coordinates and must differ. The CLI converts them to the current canvas pixels, presses with a real pointer, moves continuously and releases. It must not use `SetCoords` or a numeric assignment. The fixed mouse tolerances are: start match `1e-9`, target error at most 2 screen pixels per axis, minimum actual travel 2 pixels. These are mouse-pixel checks; they do not loosen the object coordinate tolerance.

## Commands

Run from the user's workspace, using the resolved `CLI`, so outputs go to `<workspace>/output` and not the package:

```sh
node "$CLI" check --request <request.json>
node "$CLI" build --request <request.json>
node "$CLI" preview --delivery <delivery-path>
```

Request and delivery paths are resolved against the caller's working directory. The schema, viewer and runtime are resolved from the package containing the CLI. The output root is the caller's working directory plus `output/`.

- `check`: input validation only. It does not launch the engine and does not return mathematical validity.
- `build`: validates input, checks capabilities, constructs, verifies initial facts, exports GGB, reloads it in a new empty applet, verifies reloaded facts, executes each drag sample in a fresh applet from the disk GGB, closes resources, and only then commits a delivery.
- `preview`: revalidates the complete delivery and the GGB hash, rechecks it in a headless engine, then opens the same bytes in a visible Playwright window in the selected system Chrome/Edge.

Success writes one JSON object on stdout. Failure writes one JSON object on stderr and exits non-zero. Read `error.code` and `error.diagnostics`; do not branch on the human-readable message.

`preview` emits `event=ready` when the visible window is interactive, and `event=closed` after the window is closed or the process is interrupted. A ready event does not mean resources have exited. Require exit code 0 and inspect the preview cleanup record. The delivered directory is read-only and user dragging in preview does not rewrite it.

## Related references

- [Reading verification.json](report-reading.md)
- [Installation and output layout](installation.md)
- [Triangle example](../examples/triangle.md)
- [Circle and inscribed slider polygon example](../examples/circle-inscribed-polygon.md)
- [Package CLI contract](../../../docs/demo-contract.md)
