[简体中文](readme.zh-CN.md) | [English](readme.md)

# obj-codec
![test](https://github.com/JonnyJong/obj-codec/actions/workflows/test.yml/badge.svg)

将对象编码为二进制并解码为对象，支持嵌套引用。

## 开发
```sh
npm i
npm run compile
npm run test
```

### 清理
1. 移除以下目录和文件：
	- `.rollup.cache`
	- `cache`
	- `dist`
2. 运行 `npm run compile`

## 待实现功能
- [ ] Readable(Node) 风格 API
- [ ] ReadableStream(Web) 风格 API
- [ ] 唯一指针：指向内置对象、类、函数等

## 文档

### 编码
```ts
import { ObjCodec } from 'obj-codec';
import { createWriteStream } from 'fs';

const DATA = {};

// 使用全局注册的自定义编解码器
function useGlobalCodoc() {
	const encoder = ObjCodec.encode(DATA);
	const writeStream = createWriteStream('path/to/file');

	for (const data of encoder.encode()) {
			writeStream.write(data);
	}

	writeStream.end();
}

// 使用仅限实例中的自定义编解码器
function useInstanceCodoc() {
	const codec = new ObjCodec();
	// 调用 `codec.registerCodecs` 注册仅限实例 `codec` 的自定义编解码器
	const encoder = codec.encode(DATA);
	const writeStream = createWriteStream('path/to/file');
	for (const data of encoder.encode()) {
			writeStream.write(data);
	}
	writeStream.end();
}
```

### 解码
```ts
import { ObjCodec } from 'obj-codec';
import { createReadStream } from 'fs';

// 使用全局注册的自定义编解码器
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

// 使用仅限实例中的自定义编解码器
function useInstanceCodoc() {
	const codec = new ObjCodec();
	// 调用 `codec.registerCodecs` 注册仅限实例 `codec` 的自定义编解码器
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

### 编码后数据结构
| 描述                 | 类型                                  |
| -------------------- | ------------------------------------- |
| 版本号               | `u8`                                  |
| 自定义类型映射表长度 | [弹性无符号整型](#弹性无符号整型)     |
| 自定义类型映射表     | [自定义类型映射表](#自定义类型映射表) |
| 数据对象[]           | [数据对象](#数据对象)                 |

### 自定义类型映射表
1. 结构：根据 `自定义类型映射表长度` 重复
   1. 字符串长度：[弹性无符号整型](#弹性无符号整型)
   2. 字符串
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
     2. `内置类型` 数据

参考：[编解码器](#编解码器)

### 编解码器
| ID  | 名称        | 长度（字节） | 权重（越小越先） | 可引用*  | 备注                                                                       |
| --- | ----------- | ------------ | ---------------- | -------- | -------------------------------------------------------------------------- |
| 0   | 指针        | 弹性*        | *不适用*         | *不适用* | 隐含类型，不能直接使用。由主编解码器（`ObjEncoder`、`ObjDecoder`）自动创建 |
| 1   | 二进制      |              | 2                | X        |                                                                            |
| 2   | 数字        | 8            | 0                |          |                                                                            |
| 3   | BigInt      |              | 0                |          |                                                                            |
| 4   | 字符串      |              | 1                | X        |                                                                            |
| 5   | `false`     | 0            | 0                |          | 没有数据区域                                                               |
| 6   | `true`      | 0            | 0                |          | 没有数据区域                                                               |
| 7   | `null`      | 0            | 0                |          | 没有数据区域                                                               |
| 8   | `undefined` | 0            | 0                |          | 没有数据区域                                                               |
| 9   | *对象*      |              | 5                | X        | 后备类型                                                                   |
| 10  | *数组*      |              | 5                | X        | 后备类型                                                                   |
| 11  | Set         |              | 4                | X        |                                                                            |
| 12  | Map         |              | 4                | X        |                                                                            |
| 13  | Date        | 8            | 4                | X        |                                                                            |
| 14  | 正则表达式  |              | 4                | X        |                                                                            |
| 15  | Symbol      |              | 1                | X        |                                                                            |
| 16  | *唯一指针*  |              |                  |          | **未实现**                                                                 |
| 17+ | 自定义类型  | *不适用*     | 3                | X        |                                                                            |

注：
- “弹性”长度：参考[弹性无符号整型](#弹性无符号整型)
- 可引用：若*容器类型*内包含该类型，则不会编码为原始数据，而是编码为指针器

### 弹性无符号整型
用于表示无符号整型，支持动态编码长度。

1. 表示范围：0 ~ 2^n - n（n 为编码所需的位数）
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

### 自定义编解码器
#### 定义
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

`encode` 方法可返回任意类型属于 `BasicType` 的数据。
若返回非 `BasicType` 类型，将直接作为 `BasicType` 编码，此时自定义编解码将被忽略。

`decode` 方法需返回 `Data` 类型。
参数 `encoded` 可能包含指针，此时无法解引用，需将指针保留到返回值中。

`dereference` 方法用于解除 `decode` 方法返回值中的引用。
该方法返回值将被忽略。

#### 注册
```ts
registerCodecs(id: string, codec: AnyCodec, constructor: IClass): void;
```
