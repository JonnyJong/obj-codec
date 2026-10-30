[简体中文](./custom.zh.md) | [English](./custom.md)
# Custom Codecs

Values outside the built-in types are handled by registered codecs. There are two kinds, distinguished by `kind`:
- `referable`: the entire payload must be handled by the codec itself
- `container`: payload and children are handled automatically

## Registration

Each `ObjCodec` instance has its own codec registry.

```ts
import { ObjCodec } from 'obj-codec';

// Create and register custom codecs
const codec = new ObjCodec()
	.register(pointCodec)
	.register(polylineCodec);
// Unregister custom codec
codec.unregister('Point');
```

A custom codec `name` must be non-empty and unique; a `class` can only be registered with one custom codec.

## Referable Codecs

```ts
import { ObjCodec } from 'obj-codec';
import type { CustomCodec } from 'obj-codec';

class Point {
	x: number;
	y: number;
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
}

const pointCodec: CustomCodec<Point, number> = {
	kind: 'referable',
	name: 'Point',
	class: Point,
	write(ctx, point) {
		ctx.writer.varint(point.x);
		ctx.writer.varint(point.y);
	},
	read(ctx) {
		// If the payload contains multiple segments, store them via `ctx.state`
		ctx.state ??= ctx.reader.varint();
		return new Point(ctx.state, ctx.reader.varint());
	},
};

const codec = new ObjCodec().register(pointCodec);
```

## Container Codecs

```ts
class Polyline {
	points: Point[] = [];
}

const polylineCodec: CustomCodec<Polyline> = {
	kind: 'container',
	name: 'Polyline',
	class: Polyline,
	count: (line) => line.points.length,
	forEachChild(line, emit) {
		for (const point of line.points) emit(point);
	},
	create: () => new Polyline(),
	addChild(shell, child, _state) {
		shell.points.push(child as Point);
		// return nextState;
	},
};
```

Container codecs must create the container first when decoding, then fill in children one by one.
If state needs to be shared while filling children, set the initial state in `create`, and `addChild` returns the new state.
