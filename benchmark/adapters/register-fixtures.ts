import { DomainNode, Point } from '../datasets/fixtures';

/**
 * Codec fixtures
 *
 * 每个在用的 `Codec` 实例都要注册：Node 入口与 Web 入口是两份独立的模块实例，
 * 注册表也因此各有一份 —— 只注册一边，另一边就解不开 S3 的数据。
 *
 * 与 v1 的差异：v2 的 `write` 直接写负载（类型 ID 由编码器负责），
 * `read` 直接返回值，不再需要 `deref` ——
 * 「先声明后使用」的编码顺序让指针在解码时总能解析到已建好的目标。
 */

type Registrar = {
	register(codec: unknown): void;
};

/** 写入器需要用到的方法 */
interface WriterLike {
	varint(v: number): void;
	varintBig(v: bigint): void;
	f64(v: number): void;
	utf8Prefixed(v: string): void;
}

/** 读取器需要用到的方法 */
interface ReaderLike {
	varint(): number;
	varintBig(): bigint;
	f64(): number;
	utf8Prefixed(): string;
}

/**
 * 解码上下文
 * @description
 * `state` 是跨「这次没读完」的中间状态：`Reader` 的每个方法各自原子，
 * 但一个负载里的多个字段之间不是 —— 数据在字段中途耗尽时，
 * `read` 会被整体重来，已读出的字段只剩 `ctx.state` 记得住。
 */
interface DecodeContextLike<S> {
	reader: ReaderLike;
	state: S | undefined;
}

/** `DomainNode` 负载的读取进度 */
interface DomainNodeState {
	id?: number;
	label?: string;
}

export function registerCodecFixtures(codec: Registrar): void {
	codec.register({
		kind: 'referable',
		name: 'Point',
		class: Point,
		write: (ctx: { writer: WriterLike }, data: Point) => {
			// `x` 是浮点数（数据集里是 i * 1.5），必须用 f64：
			// varint 只接受非负安全整数
			ctx.writer.f64(data.x);
		},
		read: (ctx: { reader: ReaderLike }) => new Point(ctx.reader.f64()),
	});

	codec.register({
		kind: 'referable',
		name: 'DomainNode',
		class: DomainNode,
		write: (ctx: { writer: WriterLike }, data: DomainNode) => {
			ctx.writer.varint(data.id);
			ctx.writer.utf8Prefixed(data.label);
			// `weight` 也是浮点数
			ctx.writer.f64(data.weight);
		},
		read: (ctx: DecodeContextLike<DomainNodeState>) => {
			// 三个字段逐段读，段与段之间可能被分块边界劈开：
			// 中断后 `read` 会从头重来，所以读出来的字段必须先存进 `ctx.state`，
			// 不能直接塞进 `new DomainNode(...)` 的实参 —— 那些值会随着重来一起丢掉，
			// 于是后续字段从错位的地方继续读。
			if (!ctx.state) ctx.state = {};
			if (ctx.state.id === undefined) ctx.state.id = ctx.reader.varint();
			if (ctx.state.label === undefined)
				ctx.state.label = ctx.reader.utf8Prefixed();
			return new DomainNode(ctx.state.id, ctx.state.label, ctx.reader.f64());
		},
	});
}
