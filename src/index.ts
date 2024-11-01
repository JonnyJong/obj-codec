import { ObjDecoder } from 'decoder';
import { ObjEncoder } from 'encoder';
import { AnyCodec, CodecMap, IClass } from 'types';

export {
	BinaryArray,
	BaseType,
	InternalType,
	BasicType,
	IClass,
	ICodec,
} from 'types';
export type { Pointer, ObjDecoder } from 'decoder';
export type { ObjEncoder } from 'encoder';

export class ObjCodec {
	private static _globalCodecs: CodecMap = new Map();
	private _codecs: CodecMap = new Map();
	private static register(
		scope: CodecMap,
		{
			id,
			codec,
			constructor,
		}: {
			id: string;
			codec: AnyCodec;
			constructor: IClass;
		}
	) {
		if (typeof id !== 'string') throw new TypeError('id must be a string');
		if (typeof codec !== 'object') {
			throw new TypeError('codec must be an object');
		}
		if (typeof constructor !== 'function') {
			throw new TypeError('constructor must be a function');
		}
		if (scope.has(id)) {
			throw new Error(`id ${id} has been registered`);
		}
		scope.set(id, [constructor, codec]);
	}
	private _mergeCodec() {
		let codec: CodecMap = new Map(ObjCodec._globalCodecs);
		for (const [key, value] of this._codecs) {
			codec.set(key, value);
		}
		return codec;
	}
	static registerCodecs(id: string, codec: AnyCodec, constructor: IClass) {
		ObjCodec.register(ObjCodec._globalCodecs, { id, codec, constructor });
	}
	registerCodecs(id: string, codec: AnyCodec, constructor: IClass) {
		ObjCodec.register(this._codecs, { id, codec, constructor });
	}
	static encode(root: any, options?: { ignoreUnsupportedTypes?: boolean }) {
		return new ObjEncoder({
			codec: ObjCodec._globalCodecs,
			root,
			ignoreUnsupportedTypes: options?.ignoreUnsupportedTypes,
		});
	}
	encode(root: any, options?: { ignoreUnsupportedTypes?: boolean }) {
		return new ObjEncoder({
			codec: this._mergeCodec(),
			root,
			ignoreUnsupportedTypes: options?.ignoreUnsupportedTypes,
		});
	}
	static decode(options?: { allowIncompleteDecoding?: boolean }) {
		return new ObjDecoder({
			codec: ObjCodec._globalCodecs,
			allowIncompleteDecoding: options?.allowIncompleteDecoding,
		});
	}
	decode(options?: { allowIncompleteDecoding?: boolean }) {
		return new ObjDecoder({
			codec: this._mergeCodec(),
			allowIncompleteDecoding: options?.allowIncompleteDecoding,
		});
	}
}

/*
- 基本类型 BaseType
- 内部类型 InternalType
- 指针类型（引用非基本类型）
- 唯一\非实例类型（各种类、函数）（本质为指针）
- 自定义类型
- 自定义唯一\非实例类型（各种类、函数）（暂时无法实装，需要通过某种方式确保每次指针都能正确对应）
*/
