# 自定义编解码器

内置类型之外的值，交给注册的 codec。按 `kind` 分两种：
- `referable`：整个载荷需要自行处理
- `container`：自动处理载荷和子项

## 注册

每个 `ObjCodec` 实例独享一份 Codec 注册表。

```ts
import { ObjCodec } from 'obj-codec';

// 创建并注册自定义编解码器
const codec = new ObjCodec()
	.register(pointCodec)
	.register(polylineCodec);
// 移除自定义编解码器
codec.unregister('Point');
```

自定义编解码器 `name` 必须非空且唯一，一个 `class` 只能注册一个自定义编解码器。

## 可引用编解码器

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
		// 若载荷包含多段数据，应使用 `ctx.state` 存储
		ctx.state ??= ctx.reader.varint();
		return new Point(ctx.state, ctx.reader.varint());
	},
};

const codec = new ObjCodec().register(pointCodec);
```

## 容器编解码器

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

容器编解码器解码时需先创建容器，再逐一填入子项。
若需要在填入子项时共享状态，可在 `create` 中设置初始状态，`addChild` 返回新状态。
