# Triangle Regression Example

This is a concrete teaching/regression recipe, not a universal rule. Do not copy its coordinates, labels or checks into another problem. The canonical machine-readable request is [examples/triangle.json](../../../examples/triangle.json); the deliberate static midpoint variant is [examples/triangle-counterexample.json](../../../examples/triangle-counterexample.json).

## Task used for the example

> Create triangle ABC, take the midpoint M of AB, and connect CM. Color M and CM red, show point names, and check the midpoint relation and median linkage after dragging A.

The source must remain in `request.source`. The initial coordinates below are demonstration choices and must stay in `request.choices`:

```text
A = (0,0), B = (6,0), C = (2,4)
```

They are not user-given conditions unless the user explicitly says so.

## Native program

```text
A=(0,0)
B=(6,0)
C=(2,4)
tri=Polygon(A,B,C)
M=Midpoint(A,B)
CM=Segment(C,M)
```

## Styles and checks

Styles: M red with labels visible; CM red; A, B and C labels visible.

| Check | Native evidence |
| --- | --- |
| `pointA`, `pointB`, `pointC` | independent points with expected coordinates |
| `triangle` | `tri` type triangle, parents A, B, C |
| `midpoint` | `M` type point, parents A, B, independent false, coordinates (3,0) |
| `median` | `CM` type segment, parents C, M |
| `midpointRelation` | native boolean `AreEqual(M,Midpoint(A,B))` |
| `nondegenerate` | native boolean `Area(tri)>0` |

The midpoint check verifies the native parent list, not only the current coordinate. A static point at (3,0) is the meaningful wrong variant: it initially satisfies the coordinate and even `AreEqual`, but it is independent and has no A/B parents. The dependency gate rejects it at the initial phase.

## Drag sample

```json
{"id":"moveA","requirement":"dragA","kind":"drag","label":"A","from":[0,0],"to":[-1,1],"checks":["midpointRelation","median"]}
```

Expected after a real mouse drag: A is at `(-1,1)` within the fixed pixel tolerance; M is `(2.5,0.5)` with parents A/B; CM still has parents C/M; M and CM remain red; labels remain visible; both native booleans remain 1.

## Running the example

From the package root:

```sh
node "$CLI" check --request "$PACKAGE_ROOT/examples/triangle.json"
node "$CLI" build --request "$PACKAGE_ROOT/examples/triangle.json"
node "$CLI" preview --delivery <delivery-path>
```

`$CLI` and `$PACKAGE_ROOT` are resolved as described in [request fields and CLI](../references/request-and-cli.md). A passing build is a delivery for the declared request, not an answer or a proof of the general statement.
