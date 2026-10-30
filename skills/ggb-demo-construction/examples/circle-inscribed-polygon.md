# Circle and Inscribed Regular Polygon with a Slider

This is a concrete illustration of a variable quantity. It is not a universal
rule for every construction. The machine-readable request is
[examples/circle-inscribed-polygon.json](../../../examples/circle-inscribed-polygon.json).

## Task used for the example

> 画一个圆，并在圆内作一个内接正多边形。

The number of sides is not fixed by the task. Use a GeoGebra slider for that
variable quantity instead of hard-coding one polygon.

## Choices

- O=(0,0), radius 2, A=(2,0). These are demonstration coordinates.
- `n=Slider(3,12,1,1,200,false,true,false,false)`. The range 3–12 and integer
  increment are demonstration choices. The tested engine sets a new slider's
  initial value to its minimum, so the initial value is n=3.
- `B=Rotate(A,2*pi/n,O)` keeps AB as one side of the regular n-gon.
- `poly=Polygon(A,B,n)` uses the slider value as the number of sides.

```text
O=(0,0)
A=(2,0)
c=Circle(O,A)
n=Slider(3,12,1,1,200,false,true,false,false)
B=Rotate(A, 2*pi/n, O)
poly=Polygon(A,B,n)
```

## Checks at the initial slider value

| Requirement | Evidence |
| --- | --- |
| circle | c is a circle with parents [O,A]; Radius(c)=2; A is on c |
| inscribed | B is on c; `Vertex(poly,1..3)` are at distance Radius(c) from O for the initial n=3 |
| regular | poly is a polygon with parents [A,B,n]; the three side lengths are equal for the initial n=3 |
| slider | n is an independent numeric object; its actual `slider` fact exposes min=3, max=12, width=200 and horizontal=true; the GGB XML also contains the slider element |

The CLI fact model has no separate slider type. The numeric object and its
dependencies are checkable; the slider control settings are evidenced by the
exported XML. The native `Polygon(A,B,n)` command is regular by construction,
but the automated run only samples the initial n=3. Moving the slider in preview
is interactive use, not an additional headless sample.

Do not use `SetValue` or `SetCoords` to move the slider. Do not claim that every
value 3–12 was executed; state the sampled value and the finite boundary.
