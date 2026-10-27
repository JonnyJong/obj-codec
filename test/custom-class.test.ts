import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../src/index';
import { ICodec } from '../src/types';
import { Pointer } from '../src/utils';

describe('Custom class', () => {
	class Parent {
		num: number;
		constructor(num: number) {
			this.num = num;
		}
	}
	class Child extends Parent {}
	const parentCodec: ICodec<Parent, number> = {
		name: 'parent',
		class: Parent,
		encode(data) {
			return data.num;
		},
		decode(encoded) {
			return new Parent(encoded);
		},
	};
	const childCodec: ICodec<Child, Parent> = {
		name: 'child',
		class: Child,
		encode(data) {
			return new Parent(data.num);
		},
		decode(encoded) {
			return new Child(encoded.num);
		},
		parentClasses: [Parent],
	};

	const objCodec = new ObjCodec();
	objCodec.register(childCodec);
	objCodec.register(parentCodec);

	it('Encode/Decode', () => {
		const encoder = objCodec.encode([new Parent(42), new Child(128)]);
		const decoder = objCodec.decode();
		for (const chunk of encoder.encode()) {
			decoder.decode(chunk);
		}
		const result = decoder.getResult();
		expect(result[0]).instanceOf(Parent);
		expect(result[1]).instanceOf(Child);
		expect(result[0].num).toBe(42);
		expect(result[1].num).toBe(128);
	});
});

describe('Custom class with container payload', () => {
	class Node {
		id: number;
		label: string;
		constructor(id: number, label: string) {
			this.id = id;
			this.label = label;
		}
	}
	/** Container payload: `encode` returns an array instead of a primitive. */
	const nodeCodec: ICodec<Node, [number, string]> = {
		name: 'node',
		class: Node,
		encode(data) {
			return [data.id, data.label];
		},
		decode(encoded) {
			return new Node(encoded[0], encoded[1]);
		},
		// 载荷中的重复字符串会编码成指针，由 deref 负责解引用。
		deref(node) {
			if (node.label instanceof Pointer) node.label = node.label.deref();
		},
	};

	const objCodec = new ObjCodec();
	objCodec.register(nodeCodec);

	function roundTrip(data: any) {
		const encoder = objCodec.encode(data);
		const decoder = objCodec.decode();
		for (const chunk of encoder.encode()) {
			decoder.decode(chunk);
		}
		return decoder.getResult();
	}

	it('Decodes every sibling instance', () => {
		const result = roundTrip([
			new Node(1, 'a'),
			new Node(2, 'b'),
			new Node(3, 'c'),
		]);
		expect(result).toHaveLength(3);
		for (const [i, node] of result.entries()) {
			expect(node).instanceOf(Node);
			expect(node.id).toBe(i + 1);
			expect(node.label).toBe(['a', 'b', 'c'][i]);
		}
	});

	it('Decodes a single instance', () => {
		const [node] = roundTrip([new Node(7, 'solo')]);
		expect(node).instanceOf(Node);
		expect(node.id).toBe(7);
		expect(node.label).toBe('solo');
	});

	it('Decodes nested container payloads', () => {
		const result = roundTrip({ nodes: [new Node(1, 'a'), new Node(2, 'b')] });
		expect(result.nodes).toHaveLength(2);
		expect(result.nodes[0]).instanceOf(Node);
		expect(result.nodes[1]).instanceOf(Node);
		expect(result.nodes[1].label).toBe('b');
	});

	it('Keeps identity for shared instances', () => {
		const shared = new Node(9, 'shared');
		const result = roundTrip([shared, { ref: shared }]);
		expect(result[0]).instanceOf(Node);
		expect(result[1].ref).toBe(result[0]);
	});
});

describe('Custom class with referable primitive payload', () => {
	class Tag {
		value: string;
		constructor(value: string) {
			this.value = value;
		}
	}
	/** `encode` returns a string, which is referable and occupies a pointer. */
	const tagCodec: ICodec<Tag, string> = {
		name: 'tag',
		class: Tag,
		encode(data) {
			return data.value;
		},
		decode(encoded) {
			return new Tag(encoded as string);
		},
	};

	const objCodec = new ObjCodec();
	objCodec.register(tagCodec);

	function roundTrip(data: any) {
		const encoder = objCodec.encode(data);
		const decoder = objCodec.decode();
		for (const chunk of encoder.encode()) {
			decoder.decode(chunk);
		}
		return decoder.getResult();
	}

	it('Decodes every sibling instance', () => {
		const result = roundTrip([new Tag('aa'), new Tag('bb'), new Tag('cc')]);
		expect(result).toHaveLength(3);
		for (const [i, tag] of result.entries()) {
			expect(tag).instanceOf(Tag);
			expect(tag.value).toBe(['aa', 'bb', 'cc'][i]);
		}
	});
});
