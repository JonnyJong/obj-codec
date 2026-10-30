[简体中文](./protocol.zh.md) | [English](./protocol.md)
# Protocol

## Data Structure
```
[version][flags]
[type table]
[frames]
```
The first byte is the file header; the type table is optional; after that come consecutive frames.

### Version
The version is 7 bits; `obj-codec` v2 is fixed to `0b000_0010`. Any other value reports an error immediately.

### Flags
The flag is 1 bit, occupying the lowest bit of the first byte. `0` means no custom types, and the entire type table is omitted; `1` means a type table follows.

The first byte is therefore `0b0000_0010` (no type table) or `0b0000_0011` (with type table).

### Type Table
Appears only when the flag is `1`. Each entry is `[len:varint][name:utf8]`, where `name` is the name of a custom codec. An entry with length `0` indicates the end of the table and occupies only one `0x00` byte.

The order in the table is the source of IDs; the nth item (counting from 0) has ID `64 + n`. The encoder sorts by fixed rules: the more registered codecs among its ancestors, the earlier it is; within the same layer, ascending by name in UTF-16 order. The decoder does not re-sort; it directly builds the mapping from ID to codec according to table order.

When encoding, the table lists all registered codecs, whether used or not. The decoder must register all codecs with the same names; if any is missing, it reports an error.

### Frames
The frame structure is `[id:varint][payload]`. Built-in IDs are at most 38 and occupy only one byte after encoding; custom IDs start at 64 and occupy two bytes when greater than 127. Container frame payload is a varint element count; child frames follow in order.

The first frame is the root object. Payloads of custom types are read/written by the corresponding codec; container custom types also write the count first.

#### IDs
Built-in type ID range is 0~63; custom type ID starts at 64.
The built-in types in the current version are as follows:

| ID  | Tag name       | Description                                                                                                               |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0   | POINTER        | Pointer, payload is reference number `varint`                                                                             |
| 1   | EXT_REF        | External reference, payload is index `varint` in `externalRefs`                                                           |
| 2   | NULL           |                                                                                                                           |
| 3   | UNDEFINED      |                                                                                                                           |
| 4   | FALSE          |                                                                                                                           |
| 5   | TRUE           |                                                                                                                           |
| 6   | ZERO           | `0`, no payload                                                                                                           |
| 7   | N_ZERO         | `-0`, no payload                                                                                                          |
| 8   | VARINT         | Positive safe integer, LEB128                                                                                             |
| 9   | N_VARINT       | Negative safe integer, payload is absolute value, LEB128                                                                  |
| 10  | F64            | Other numbers: unsafe integers, decimals, NaN, ±Inf, 8 bytes little-endian                                                |
| 11  | BIGINT_ZERO    | `0n`, no payload                                                                                                          |
| 12  | BIGINT         | Positive BigInt, LEB128                                                                                                   |
| 13  | N_BIGINT       | Negative BigInt, payload is absolute value, LEB128                                                                        |
| 14  | *STRING        | `[len:varint][utf8]`                                                                                                      |
| 15  | *ARRAY_BUFFER  | `ArrayBuffer`                                                                                                             |
| 16  | *I8_ARRAY      | `Int8Array`                                                                                                               |
| 17  | *U8_ARRAY      | `Uint8Array`                                                                                                              |
| 18  | *U8C_ARRAY     | `Uint8ClampedArray`                                                                                                       |
| 19  | *I16_ARRAY     | `Int16Array`                                                                                                              |
| 20  | *U16_ARRAY     | `Uint16Array`                                                                                                             |
| 21  | *I32_ARRAY     | `Int32Array`                                                                                                              |
| 22  | *U32_ARRAY     | `Uint32Array`                                                                                                             |
| 23  | *F16_ARRAY     | `Float16Array`, Node 22 does not have this type; the encoder does not produce it, and the decoder reports an unknown type |
| 24  | *F32_ARRAY     | `Float32Array`                                                                                                            |
| 25  | *F64_ARRAY     | `Float64Array`                                                                                                            |
| 26  | *BI64_ARRAY    | `BigInt64Array`                                                                                                           |
| 27  | *BU64_ARRAY    | `BigUint64Array`                                                                                                          |
| 28  | *DATA_VIEW     | `DataView`                                                                                                                |
| 29  | *ARRAY         | Array, payload is length, holes are written as `ARRAY_HOLE`                                                               |
| 30  | ARRAY_HOLE     | Array hole, holes in arrays are encoded as it                                                                             |
| 31  | *OBJECT        | Object, payload is twice the number of key-value pairs, children alternate key, value                                     |
| 32  | *SET           | `Set`, payload is element count                                                                                           |
| 33  | *MAP           | `Map`, payload is twice the number of key-value pairs, children alternate key, value                                      |
| 34  | *DATE          | `Date`, payload is 8-byte f64 millisecond timestamp                                                                       |
| 35  | *REGEX         | `RegExp`, payload is two `[len:varint][utf8]` segments, `source`, `flags` in order                                        |
| 36  | *SYMBOL        | `Symbol` without description, no payload                                                                                  |
| 37  | *SYMBOL_DESC   | `Symbol` with description, payload is description                                                                         |
| 38  | *SYMBOL_GLOBAL | Global `Symbol`, payload is description, restored via `Symbol.for`                                                        |

Notes:
- `*` means referable
- Payloads 15~28 are uniformly `[offset:varint][byteLength:varint][bytes]`, writing only the bytes covered by the view. `offset` is the original view offset; the decoder reads but does not use it; the restored value is a new view starting from 0
- `RegExp` does not save `lastIndex`
- 39~63 are currently unused

### References
Referable types are numbered sequentially starting from 0 on first appearance. When the same value appears again, only `[POINTER][reference number]` is written.

The decoder builds the table in the same order. Scalars are entered into the table after the whole value is read; for containers, an empty shell is created and entered into the table after the header is read, and children are then filled into the shell, so circular references can be decoded.

External references take precedence over internal references; values found in `externalRefs` are written only as `[EXT_REF][index]`; both sides' lists must be consistent.

Numbers, bigint, booleans, `null`, `undefined`, and `ARRAY_HOLE` are not referable; a complete frame is written each time.

## Encoding/Decoding Algorithm
Uses BFS.

Encoding writes the root frame first, then puts encountered containers into a queue. Each time a container is dequeued, all its children are written consecutively, and child containers continue to be enqueued. Decoding is the same: after reading a container header, create an empty shell and enqueue it; when its turn comes, fill it in the same order.

Frames are not aligned; bytes can be split at any position and transmitted in chunks; decoding only recognizes frame order.

In the example, `DEF` means first appearance: write type ID and payload and register a reference; `REF` means pointer; `ref` is the reference number.

Source:
```
root: {
  k1: {
    k1: 1,
    k2: 2,
    k3: root,
  },
  k2: root,
}
```

Encoded result:
```
[VER][FLAG]
# root object
[DEF OBJECT ref=0 count=4]
  [DEF STRING ref=1 'k1']
  [DEF OBJECT ref=2 count=6]
  [DEF STRING ref=3 'k2']
  [REF 0]
# children of the `k1` object
  [REF 1]
  [VARINT 1]
  [REF 3]
  [VARINT 2]
  [DEF STRING ref=4 'k3']
  [REF 0]
```
