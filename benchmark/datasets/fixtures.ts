/**
 * Shared fixture types for the S3 proprietary suite.
 * Both the obj-codec adapter (registered codec) and the seroval adapter
 * (plugin) reference these classes, so the datasets and the adapters agree on
 * one definition instead of each inventing its own.
 */

/** Container payload: what a rich custom codec naturally wants to return. */
export class DomainNode {
	id: number;
	label: string;
	weight: number;

	constructor(id: number, label: string, weight: number) {
		this.id = id;
		this.label = label;
		this.weight = weight;
	}
}

/** Primitive payload: the custom-codec shape obj-codec handles correctly. */
export class Point {
	x: number;

	constructor(x: number) {
		this.x = x;
	}
}

// seroval's deserialize() evaluates the serialized expression in the global
// scope, so both classes have to be reachable by name.
const globals = globalThis as Record<string, unknown>;
globals.DomainNode = DomainNode;
globals.Point = Point;
