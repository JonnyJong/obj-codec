import { ObjDecoder } from 'decoder';
import { ObjEncoder } from 'encoder';

export type BinaryArray =
	| ArrayBuffer
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array
	| BigInt64Array
	| BigUint64Array
	| DataView;
export type BaseType =
	| BinaryArray
	| number
	| bigint
	| string
	| false
	| true
	| null
	| undefined;
export type InternalType =
	| { [x: string | number | symbol]: BasicType }
	| Array<BasicType>
	| Set<BasicType>
	| Map<BasicType, BasicType>
	| Date
	| RegExp
	| Symbol;
export type BasicType = BaseType | InternalType;

export type IClass = new (...args: any[]) => any;

export interface ICodec<
	Data,
	DecodeMiddle = Data,
	EncodeResult extends BasicType,
> {
	// encodingLength?: number;
	encode(data: Data): EncodeResult;
	decode(encoded: EncodeResult): DecodeMiddle;
	dereference?(data: DecodeMiddle): any;
}

export type AnyCodec = ICodec<any, any, any>;
export type CodecMap = Map<string, [IClass, AnyCodec]>;

export interface BaseCodec<
	Data,
	DecodeMiddle = Data,
	EncodeResult extends Uint8Array = Uint8Array,
> extends ICodec<Data, DecodeMiddle, EncodeResult> {
	encodingLength?: number;
	encode(data: Data, encoder: ObjEncoder): EncodeResult;
	decode(encoded: EncodeResult, decoder: ObjDecoder): DecodeMiddle;
}

export interface InternalTypeItem {
	type: any;
	typeId: number;
	codec: BaseCodec<any>;
}

export type InternalCodec = [
	BaseCodec<BinaryArray>,
	BaseCodec<number>,
	BaseCodec<bigint>,
	BaseCodec<string>,
	BaseCodec<false>,
	BaseCodec<true>,
	BaseCodec<null>,
	BaseCodec<undefined>,
	BaseCodec<{ [x: string | number | symbol]: any }>,
	BaseCodec<Array<any>>,
	BaseCodec<Set<any>>,
	BaseCodec<Map<any, any>>,
	BaseCodec<Date>,
	BaseCodec<RegExp>,
	BaseCodec<Symbol>,
];
