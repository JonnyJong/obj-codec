[简体中文](readme.zh-CN.md) | [English](readme.md)
# obj-codec
![test](https://github.com/JonnyJong/obj-codec/actions/workflows/test.yml/badge.svg)

将对象编码为二进制并解码为对象，支持嵌套引用、编解码自定义对象、唯一指针……

## 安装
```sh
npm install obj-codec
# 或
yarn add obj-codec
# 或
pnpm add obj-codec
```

## 特性
- 支持 JavaScript 所有基本数据类型
  - 原始类型：number, bigint, string, boolean, null, undefined
  - 集合类型：Array, Set, Map
  - 特殊对象：Date, RegExp, Symbol
  - 二进制数据：Uint8Array 等
- 引用处理
  - 自动处理嵌套引用
  - 完美支持循环引用
  - [唯一指针](#唯一指针)支持
- 流式处理

## 使用

### 默认 API
```ts
import { ObjCodec } from 'obj-codec';

// 使用全局编解码器
const encoder = ObjCodec.encode(target);
const decoder = ObjCodec.decode();
for (const chunk of encoder.encode()) {
	decoder.decode(chunk);
}
const result = decoder.getResult();

// 使用一般编解码器
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

// 使用全局编解码器
const encoder = ObjCodec.encode(target);
const decoder = ObjCodec.decode();
encoder.pipe(decoder).on('finish', () => {
	const result = decoder.getResult();
});

// 使用一般编解码器
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

// 使用全局编解码器
const encoder = ObjCodec.encode(target);
const decoder = ObjCodec.decode();
await encoder.pipeTo(decoder);
const result = decoder.getResult();

// 使用一般编解码器
const objCodec = new ObjCodec();
const encoder = objCodec.encode(target);
const decoder = objCodec.decode();
await encoder.pipeTo(decoder);
const result = decoder.getResult();

```

## 构建/开发
```sh
pnpm i
pnpm build
pnpm test
```

## 数据结构

| 描述                 | 类型                                  |
| -------------------- | ------------------------------------- |
| 版本号               | u8                                    |
| 自定义类型映射表长度 | [弹性无符号整型](#弹性无符号整型)     |
| 自定义类型映射表     | [自定义类型映射表](#自定义类型映射表) |
| 数据对象表           | [数据对象](#数据对象)数组             |

### 自定义类型映射表
1. 结构：`[字符串长度, 字符串][]`
   - 字符串长度：[弹性无符号整型](#弹性无符号整型)
   - 字符串：参考[编解码器](#编解码器)
2. 映射
   - 所有的字符串都必须唯一
   - `数据对象` 类型 ID 若大于 16，则减去 17 后为映射表的索引
   - 编码时应先创建映射表
   - 解码时应先解码映射表，根据映射表创建`自定义类型编解码器`数组

### 数据对象
1. 根对象：第一个对象为根对象
2. 结构
   - 内置类型
     1. 类型 ID：[弹性无符号整型](#弹性无符号整型)
     2. 数据长度（仅非定长编码）：[弹性无符号整型](#弹性无符号整型)
     3. 数据
   - 自定义类型
     1. 类型 ID：[弹性无符号整型](#弹性无符号整型)
     3. 内置类型数据

参考：[编解码器](#编解码器)

### 编解码器
| ID  | 名称        | 长度（字节） | 权重（越小越先） | 可引用*  | 备注                                                                       |
| --- | ----------- | ------------ | ---------------- | -------- | -------------------------------------------------------------------------- |
| 0   | 指针        | 弹性*        | *不适用*         | *不适用* | 隐含类型，不能直接使用。由主编解码器（`ObjEncoder`、`ObjDecoder`）自动创建 |
| 1   | 二进制      |              | 2                | ✅        |                                                                            |
| 2   | 数字        | 8            | 0                |          |                                                                            |
| 3   | BigInt      |              | 0                |          |                                                                            |
| 4   | 字符串      |              | 1                | ✅        |                                                                            |
| 5   | `false`     | 0            | 0                |          | 没有数据区域                                                               |
| 6   | `true`      | 0            | 0                |          | 没有数据区域                                                               |
| 7   | `null`      | 0            | 0                |          | 没有数据区域                                                               |
| 8   | `undefined` | 0            | 0                |          | 没有数据区域                                                               |
| 9   | *对象*      |              | 5                | ✅        | 后备类型                                                                   |
| 10  | *数组*      |              | 5                | ✅        | 后备类型                                                                   |
| 11  | Set         |              | 4                | ✅        |                                                                            |
| 12  | Map         |              | 4                | ✅        |                                                                            |
| 13  | Date        | 8            | 4                | ✅        |                                                                            |
| 14  | 正则表达式  |              | 4                | ✅        |                                                                            |
| 15  | Symbol      |              | 1                | ✅        |                                                                            |
| 16  | 唯一指针    | 弹性*        |                  |          |                                                                            |
| 17+ | 自定义类型  | *不适用*     | 3                | ✅        |                                                                            |

注：
- “弹性”长度：参考[弹性无符号整型](#弹性无符号整型)
- 可引用：若*容器类型*内包含该类型，则不会编码为原始数据，而是编码为指针器

### 弹性无符号整型
用于表示无符号整型，支持动态编码长度。

1. 表示范围：$0$ 至 $2^n-n$（n 为编码所需的位数）
2. 结构
   - 每个字节的高位（第8位）用于指示后续字节的存在性：
     - 如果高位为 1，表示后面还有更多字节。
     - 如果高位为 0，表示这是最后一个字节。
   - 其余的 7 位用于存储实际的数据部分。
3. 编码示例
   - `0` -> `0b0000_0000`
   - `127` -> `0b0111_1111`
   - `128` -> `0b1000_0000` 和 `0b0000_0001`
   - `129` -> `0b1000_0001` 和 `0b0000_0001`

### 唯一指针
唯一指针是一种特殊编码机制，用于处理那些：
- **不适合直接编码**的环境特定对象（如 `globalThis`、内置 `Symbol` 等）
- **需要保持引用一致性**的全局唯一对象
- **无法或不适合**通过常规编解码器处理的值

### 自定义编解码器

#### 定义
```ts
/**
 * 编解码器
 * @template Type 数据类型
 * @template EncodeResult 编码类型
 * @template DecodeMiddle 解码中间类型
 */
interface ICodec<
	Type extends IClass,
	EncodeResult,
	DecodeMiddle extends Type = Type,
> {
	/**
	 * 编解码器名称
	 * @description
	 * 通过编解码器名称确定编解码器，
	 * 请确保编解码器名称唯一
	 */
	name: string;
	/** 编解码目标类 */
	class: Type;
	/**
	 * 编解码目标类父类
	 * @description
	 * 用于确定匹配顺序
	 * @example
	 * [ParentClass, GrandClass, GrandGrandClass]
	 */
	parentClasses?: IClass[];
	/**
	 * 编码
	 * @param data 数据
	 */
	encode(data: Type): EncodeResult;
	/**
	 * 解码
	 * @param encoded 已编码数据
	 */
	decode(encoded: EncodeResult): DecodeMiddle;
	/**
	 * 解引用
	 * @param data 解码中间数据
	 */
	deref?(data: DecodeMiddle): void;
}
```

- `encode` 方法可返回任意类型的数据，可返回自定义类型的数据。
- `decode` 方法需返回 `Type` 类型。参数 `encoded` 可能包含指针，此时无法解引用，需将指针保留到返回值中。
- `dereference` 方法用于解除 `decode` 方法返回值中的引用。该方法返回值将被忽略。

#### 注册
```ts
// 注册全局编解码器
ObjCodec.register(codec);
// 注册编解码器
const objCodec = new ObjCodec();
objCodec.register(codec);
```
