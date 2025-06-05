[简体中文](readme.zh-CN.md) | [English](readme.md)
# obj-codec
![test](https://github.com/JonnyJong/obj-codec/actions/workflows/test.yml/badge.svg)

Encode objects into binary and decode binary back into objects, supporting nested references, custom object encoding/decoding, unique pointers...

## Installation
```sh
npm install obj-codec
# or
yarn add obj-codec
# or
pnpm add obj-codec
```

## Features
- Supports all JavaScript primitive data types
  - Primitive types: number, bigint, string, boolean, null, undefined
  - Collection types: Array, Set, Map
  - Special objects: Date, RegExp, Symbol
  - Binary data: Uint8Array, etc.
- Reference handling
  - Automatic nested reference processing
  - Perfect support for circular references
  - [Unique pointer](#unique-pointer) support
- Streaming processing

## Usage

### Default API
```ts
import { ObjCodec } from 'obj-codec';

// Using global codec
const encoder = ObjCodec.encode(target);
const decoder = ObjCodec.decode();
for (const chunk of encoder.encode()) {
	decoder.decode(chunk);
}
const result = decoder.getResult();

// Using general codec
const objCodec = new ObjCodec();
const encoder = objCodec.encode(target);
const decoder = objCodec.decode();
for (const chunk of encoder.encode()) {
	decoder.decode(chunk);
}
const result = decoder.getResult();

```

### Node Stream API
```ts
import { ObjCodec } from 'obj-codec';

// Using global codec
const encoder = ObjCodec.encode(target);
const decoder = ObjCodec.decode();
encoder.pipe(decoder).on('finish', () => {
	const result = decoder.getResult();
});

// Using general codec
const objCodec = new ObjCodec();
const encoder = objCodec.encode(target);
const decoder = objCodec.decode();
encoder.pipe(decoder).on('finish', () => {
	const result = decoder.getResult();
});

```

### Web Stream API
```ts
import { ObjCodec } from 'obj-codec/web';

// Using global codec
const encoder = ObjCodec.encode(target);
const decoder = ObjCodec.decode();
await encoder.pipeTo(decoder);
const result = decoder.getResult();

// Using general codec
const objCodec = new ObjCodec();
const encoder = objCodec.encode(target);
const decoder = objCodec.decode();
await encoder.pipeTo(decoder);
const result = decoder.getResult();

```

## Build/Development
```sh
pnpm i
pnpm build
pnpm test
```

## Data Structure

| Description            | Type                                                    |
| ---------------------- | ------------------------------------------------------- |
| Version number         | u8                                                      |
| Custom type map length | [Flexible Unsigned Integer](#flexible-unsigned-integer) |
| Custom type map        | [Custom Type Map](#custom-type-map)                     |
| Data object table      | Array of [Data Objects](#data-object)                   |

### Custom Type Map
1. Structure: `[string length, string][]`
   - String length: [Flexible Unsigned Integer](#flexible-unsigned-integer)
   - String: Refer to [Codec](#codec)
2. Mapping
   - All strings must be unique
   - If the type ID of a `Data Object` is greater than 16, subtract 17 to get the index in the map
   - The map should be created first during encoding
   - During decoding, decode the map first and create an array of `custom type codecs` based on it

### Data Object
1. Root object: The first object is the root object
2. Structure
   - Built-in types
     1. Type ID: [Flexible Unsigned Integer](#flexible-unsigned-integer)
     2. Data length (only for non-fixed-length encoding): [Flexible Unsigned Integer](#flexible-unsigned-integer)
     3. Data
   - Custom types
     1. Type ID: [Flexible Unsigned Integer](#flexible-unsigned-integer)
     3. Built-in type data

Reference: [Codec](#codec)

### Codec
| ID  | Name           | Length (bytes) | Priority (lower is higher) | Referenceable* | Notes                                                                                                    |
| --- | -------------- | -------------- | -------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| 0   | Pointer        | Flexible*      | *N/A*                      | *N/A*          | Implicit type, cannot be used directly. Automatically created by main codec (`ObjEncoder`, `ObjDecoder`) |
| 1   | Binary         |                | 2                          | ✅              |                                                                                                          |
| 2   | Number         | 8              | 0                          |                |                                                                                                          |
| 3   | BigInt         |                | 0                          |                |                                                                                                          |
| 4   | String         |                | 1                          | ✅              |                                                                                                          |
| 5   | `false`        | 0              | 0                          |                | No data section                                                                                          |
| 6   | `true`         | 0              | 0                          |                | No data section                                                                                          |
| 7   | `null`         | 0              | 0                          |                | No data section                                                                                          |
| 8   | `undefined`    | 0              | 0                          |                | No data section                                                                                          |
| 9   | *Object*       |                | 5                          | ✅              | Fallback type                                                                                            |
| 10  | *Array*        |                | 5                          | ✅              | Fallback type                                                                                            |
| 11  | Set            |                | 4                          | ✅              |                                                                                                          |
| 12  | Map            |                | 4                          | ✅              |                                                                                                          |
| 13  | Date           | 8              | 4                          | ✅              |                                                                                                          |
| 14  | RegExp         |                | 4                          | ✅              |                                                                                                          |
| 15  | Symbol         |                | 1                          | ✅              |                                                                                                          |
| 16  | Unique Pointer | Flexible*      |                            |                |                                                                                                          |
| 17+ | Custom Type    | *N/A*          | 3                          | ✅              |                                                                                                          |

Notes:
- "Flexible" length: Refer to [Flexible Unsigned Integer](#flexible-unsigned-integer)
- Referenceable: If a *container type* contains this type, it will not be encoded as raw data but as a pointer

### Flexible Unsigned Integer
Used to represent unsigned integers with dynamic encoding length.

1. Range: $0$ to $2^n-n$ (where n is the number of bits required for encoding)
2. Structure
   - The high bit (8th bit) of each byte indicates the presence of subsequent bytes:
     - If the high bit is 1, more bytes follow.
     - If the high bit is 0, this is the last byte.
   - The remaining 7 bits store the actual data.
3. Encoding examples
   - `0` -> `0b0000_0000`
   - `127` -> `0b0111_1111`
   - `128` -> `0b1000_0000` and `0b0000_0001`
   - `129` -> `0b1000_0001` and `0b0000_0001`

### Unique Pointer
A unique pointer is a special encoding mechanism for handling:
- Environment-specific objects that **cannot be directly encoded** (e.g., `globalThis`, built-in `Symbol`, etc.)
- Globally unique objects that **need to maintain reference consistency**
- Values that **cannot or should not** be processed by regular codecs

### Custom Codec

#### Definition
```ts
/**
 * Codec
 * @template Type Data type
 * @template EncodeResult Encoding type
 * @template DecodeMiddle Decoding intermediate type
 */
interface ICodec<
	Type extends IClass,
	EncodeResult,
	DecodeMiddle extends Type = Type,
> {
	/**
	 * Codec name
	 * @description
	 * The codec is identified by its name,
	 * ensure the name is unique
	 */
	name: string;
	/** Target class for encoding/decoding */
	class: Type;
	/**
	 * Parent classes of the target class
	 * @description
	 * Used to determine matching order
	 * @example
	 * [ParentClass, GrandClass, GrandGrandClass]
	 */
	parentClasses?: IClass[];
	/**
	 * Encode
	 * @param data Data
	 */
	encode(data: Type): EncodeResult;
	/**
	 * Decode
	 * @param encoded Encoded data
	 */
	decode(encoded: EncodeResult): DecodeMiddle;
	/**
	 * Dereference
	 * @param data Decoding intermediate data
	 */
	deref?(data: DecodeMiddle): void;
}
```

- The `encode` method can return any type of data, including custom types.
- The `decode` method must return a `Type`. The `encoded` parameter may contain pointers, which should be preserved in the return value if they cannot be dereferenced.
- The `dereference` method is used to resolve references in the return value of `decode`. Its return value will be ignored.

#### Registration
```ts
// Register global codec
ObjCodec.register(codec);
// Register codec
const objCodec = new ObjCodec();
objCodec.register(codec);
```
