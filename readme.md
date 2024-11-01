[简体中文](readme.zh-CN.md) | [English](readme.md)

# obj-codec
![test](https://github.com/JonnyJong/obj-codec/actions/workflows/Test/badge.svg)

Encodes and decodes objects to binary, supports nested references.

## Dev
```sh
npm i
npm run compile
npm run test
```

## Clean
1. Remove the following directories and files:
	- `.rollup.cache`
	- `cache`
	- `dist`
2. Run `npm run compile`

## Features TODO List
- [ ] Readable(Node) Style API
- [ ] ReadableStream(Web) Style API
- [ ] Unique Pointer:  Points to built-in objects, classes, functions, etc

## Document

### Encode
```ts
import { ObjCodec } from 'obj-codec';
import { createWriteStream } from 'fs';

const DATA = {};

// Using globally registered custom codecs
function useGlobalCodoc() {
	const encoder = ObjCodec.encode(DATA);
	const writeStream = createWriteStream('path/to/file');

	for (const data of encoder.encode()) {
			writeStream.write(data);
	}

	writeStream.end();
}

//  Use custom codecs that are instance-only
function useInstanceCodoc() {
	const codec = new ObjCodec();
	//  Call `codec.registerCodecs` to register custom codecs limited to the instance `codec
	const encoder = codec.encode(DATA);
	const writeStream = createWriteStream('path/to/file');
	for (const data of encoder.encode()) {
			writeStream.write(data);
	}
	writeStream.end();
}
```

### Decode
```ts
import { ObjCodec } from 'obj-codec';
import { createReadStream } from 'fs';

// Using globally registered custom codecs
function useGlobalCodoc() {
	const decoder = ObjCodec.decode();
	const readStream = createReadStream('path/to/file');

	readStream.on('data', (chunk) => {
		decoder.write(new Uint8Array(chunk));
	});

	readStream.on('end', () => {
		encoder.end().then(console.log);
	});
}

//  Use custom codecs that are instance-only
function useInstanceCodoc() {
	const codec = new ObjCodec();
	//  Call `codec.registerCodecs` to register custom codecs limited to the instance `codec
	const decoder = codec.decode();
	const readStream = createReadStream('path/to/file');

	readStream.on('data', (chunk) => {
		decoder.write(new Uint8Array(chunk));
	});

	readStream.on('end', () => {
		encoder.end().then(console.log);
	});
}
```

### Encoded Data Structure
| Descripton                       | Type                                                    |
| -------------------------------- | ------------------------------------------------------- |
| Version                          | `u8`                                                    |
| Custom Type Mapping Table Length | [Flexable Unsigned Integer](#flexable-unsigned-integer) |
| Custom Type Mapping Table        | [Custom Type Mapping Table](#custom-type-mapping-table) |
| Data Object[]                    | [Data Object](#data-object)                             |

### Custom Type Mapping Table
1. Structure: Repeat according to `Length of customized type mapping table`.
	 1. String length: [Flexable Unsigned Integer](#flexable-unsigned-integer)
	 2. String
2. Mapping
	 - All strings must be unique
	 -  The `Data Object` type ID is the index of the mapping table if it is greater than 16, minus 17.
	 - The mapping table should be created at the time of coding
	 - Decoding should start by decoding the mapping table and creating an array of `Custom Type Codecs` based on the mapping table

### Data Object
1. Root object: The first object is the root object
2. Structure
	 - Internal Type
		 1. Type ID: [Flexable Unsigned Integer](#flexable-unsigned-integer)
		 2. Data Length (non-fixed-length encoding only): [Flexable Unsigned Integer](#flexable-unsigned-integer)
		 3. Data
	 - Custom Type
		 1. Type ID: [Flexable Unsigned Integer](#flexable-unsigned-integer)
		 2. `Internal Type` Data

Reference: [Codec](#codec)

### Codec
| ID  | Name             | Length (Bytes) | Weights (the smaller the first) | Referencable* | Comment                                                                                                       |
| --- | ---------------- | -------------- | ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| 0   | Pointer          | Flexable*      | *N/A*                           | *N/A*         | Implicit type, cannot be used directly. Created automatically by the main codecs (`ObjEncoder`, `ObjDecoder`) |
| 1   | Binary           |                | 2                               | X             |                                                                                                               |
| 2   | Number           | 8              | 0                               |               |                                                                                                               |
| 3   | BigInt           |                | 0                               |               |                                                                                                               |
| 4   | String           |                | 1                               | X             |                                                                                                               |
| 5   | `false`          | 0              | 0                               |               | No data area                                                                                                  |
| 6   | `true`           | 0              | 0                               |               | No data area                                                                                                  |
| 7   | `null`           | 0              | 0                               |               | No data area                                                                                                  |
| 8   | `undefined`      | 0              | 0                               |               | No data area                                                                                                  |
| 9   | *Object*         |                | 5                               | X             | Fallback type                                                                                                 |
| 10  | *Array*          |                | 5                               | X             | Fallback type                                                                                                 |
| 11  | Set              |                | 4                               | X             |                                                                                                               |
| 12  | Map              |                | 4                               | X             |                                                                                                               |
| 13  | Date             | 8              | 4                               | X             |                                                                                                               |
| 14  | RegExp           |                | 4                               | X             |                                                                                                               |
| 15  | Symbol           |                | 1                               | X             |                                                                                                               |
| 16  | *Unique Pointer* |                |                                 |               | **Not Implemented**                                                                                           |
| 17+ | Custom Type      | *N/A*          | 3                               | X             |                                                                                                               |

Comments:
- "Flexable" Length：reference [Flexable Unsigned Integer](#flexable-unsigned-integer)
- Referenceable: if the type is contained within a *container type*, it is not encoded as raw data, but as a pointer

### Flexable Unsigned Integer
Used to represent unsigned integers, supports dynamic encoding of lengths.

1. Representation range: 0 ~ 2^n - n (n is the number of bits required for encoding)
2. Structure
   - The high bit (bit 8) of each byte is used to indicate the existence of subsequent bytes:
   - If the high bit is 1, it indicates that there are more bytes to follow.
   - If the high bit is 1, more bytes follow. If the high bit is 0, this is the last byte.
   - The remaining 7 bits are used to store the actual data portion.
3. Encoding example
   - `0` -> `0b0000_0000
   - `127` -> `0b0111_1111`
   - `128` -> `0b1000_0000` and `0b0000_0001
   - `129` -> `0b1000_0001` and `0b0000_0001`.

### Custom Codec
#### Define
```ts
interface ICodec<
	Data,
	DecodeMiddle = Data,
	EncodeResult extends BasicType,
> {
	encode(data: Data): EncodeResult;
	decode(encoded: EncodeResult): DecodeMiddle;
	dereference?(data: DecodeMiddle): any;
}
```

The `encode` method can return data of any type belonging to `BasicType`.
If a non-`BasicType` type is returned, it will be encoded directly as a `BasicType`, and custom codecs will be ignored.

The `decode` method needs to return `Data` type.
Parameter `encoded` may contain a pointer, which cannot be dereferenced and should be kept in the return value.

The `dereference` method is used to dereference the return value of the `decode` method.
The method return value is ignored.

#### Register
```ts
registerCodecs(id: string, codec: AnyCodec, constructor: IClass): void;
```
