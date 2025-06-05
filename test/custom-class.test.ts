import { describe, expect, it } from 'vitest';
import { ObjCodec } from '../src/index';
import { ICodec } from '../src/types';

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
