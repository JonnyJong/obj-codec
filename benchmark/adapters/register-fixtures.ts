import { DomainNode, Point } from '../datasets/fixtures';

/**
 * Codec fixtures have to be registered on every ObjCodec instance in play: the
 * Node entry and the web entry are separate module instances with separate
 * global registries, so registering only on one leaves the other unable to
 * decode S3 payloads.
 *
 * The `Pointer` class is also per-build, so `deref` detects a pointer by shape
 * rather than with `instanceof`.
 */

type Registrar = {
	register(codec: unknown): void;
};

function isPointerLike(value: unknown): value is { deref(): string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { deref?: unknown }).deref === 'function'
	);
}

export function registerCodecFixtures(codec: Registrar): void {
	codec.register({
		name: 'Point',
		class: Point,
		encode: (data: Point) => data.x,
		decode: (encoded: number) => new Point(encoded),
	});

	codec.register({
		name: 'DomainNode',
		class: DomainNode,
		encode: (data: DomainNode) => [data.id, data.label, data.weight],
		decode: (encoded: unknown[]) =>
			new DomainNode(
				encoded[0] as number,
				encoded[1] as string,
				encoded[2] as number,
			),
		// Repeated labels are emitted as pointers; resolve them here.
		deref: (node: DomainNode) => {
			if (isPointerLike(node.label)) node.label = node.label.deref();
		},
	});
}
