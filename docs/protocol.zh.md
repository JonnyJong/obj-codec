# 协议

## 数据结构
```
[版本][标志]
[类型表]
[帧]
```
首字节是文件头，类型表可有可无，之后是连续的帧。

### 版本
版本为 7 比特，`obj-codec` v2 固定为 `0b000_0010`。其它值直接报错。

### 标志
标志为 1 比特，占首字节的最低位。`0` 表示无自定义类型，类型表整段省略；`1` 表示后面有类型表。

首字节因此是 `0b0000_0010`（无类型表）或 `0b0000_0011`（有类型表）。

### 类型表
只在标志为 `1` 时出现。每项为 `[len:varint][name:utf8]`，`name` 是自定义 codec 的名称。长度为 `0` 的一项表示表结束，只占一个 `0x00` 字节。

表里的顺序就是 ID 来源，第 n 项（从 0 数）的 ID 为 `64 + n`。编码端按固定规则排序，祖先中已注册的 codec 越多越靠前，同一层按名称的 UTF-16 顺序升序。解码端不再排序，直接按表顺序建立 ID 到 codec 的映射。

编码时表里列出全部已注册 codec，不论有没有用到。解码端必须注册同名的全部 codec，缺一个就报错。

### 帧
帧结构为 `[id:varint][payload]`。内置 ID 最大 38，编码后只占一个字节；自定义 ID 从 64 起，超过 127 时占两个字节。容器帧的载荷为 varint 元素计数，子项的帧按顺序跟在后面。

首帧为根对象。自定义类型的载荷由对应 codec 读写，容器型自定义类型同样先写计数。

#### ID
内置类型 ID 范围为 0~63，自定义类型 ID 起点为 64。
当前版本内置类型如下：

| ID  | 标签名         | 说明                                                                |
| --- | -------------- | ------------------------------------------------------------------- |
| 0   | POINTER        | 指针，载荷为引用号 `varint`                                         |
| 1   | EXT_REF        | 外部引用，载荷为 `externalRefs` 中的索引 `varint`                   |
| 2   | NULL           |                                                                     |
| 3   | UNDEFINED      |                                                                     |
| 4   | FALSE          |                                                                     |
| 5   | TRUE           |                                                                     |
| 6   | ZERO           | `0`，无载荷                                                         |
| 7   | N_ZERO         | `-0`，无载荷                                                        |
| 8   | VARINT         | 正安全整数，LEB128                                                  |
| 9   | N_VARINT       | 负安全整数，载荷为绝对值，LEB128                                    |
| 10  | F64            | 其余数字：非安全整数、小数、NaN、±Inf，8 字节小端                   |
| 11  | BIGINT_ZERO    | `0n`，无载荷                                                        |
| 12  | BIGINT         | 正 BigInt，LEB128                                                   |
| 13  | N_BIGINT       | 负 BigInt，载荷为绝对值，LEB128                                     |
| 14  | *STRING        | `[len:varint][utf8]`                                                |
| 15  | *ARRAY_BUFFER  | `ArrayBuffer`                                                       |
| 16  | *I8_ARRAY      | `Int8Array`                                                         |
| 17  | *U8_ARRAY      | `Uint8Array`                                                        |
| 18  | *U8C_ARRAY     | `Uint8ClampedArray`                                                 |
| 19  | *I16_ARRAY     | `Int16Array`                                                        |
| 20  | *U16_ARRAY     | `Uint16Array`                                                       |
| 21  | *I32_ARRAY     | `Int32Array`                                                        |
| 22  | *U32_ARRAY     | `Uint32Array`                                                       |
| 23  | *F16_ARRAY     | `Float16Array`，Node 22 没有该类型，编码端不产生，解码端报未知类型  |
| 24  | *F32_ARRAY     | `Float32Array`                                                      |
| 25  | *F64_ARRAY     | `Float64Array`                                                      |
| 26  | *BI64_ARRAY    | `BigInt64Array`                                                     |
| 27  | *BU64_ARRAY    | `BigUint64Array`                                                    |
| 28  | *DATA_VIEW     | `DataView`                                                          |
| 29  | *ARRAY         | 数组，载荷为长度，空位写成 `ARRAY_HOLE`                             |
| 30  | ARRAY_HOLE     | 数组空洞，数组中的空位编码成它                                      |
| 31  | *OBJECT        | 对象，载荷为键值对数的 2 倍，子项按键、值交替                       |
| 32  | *SET           | `Set`，载荷为元素个数                                               |
| 33  | *MAP           | `Map`，载荷为键值对数的 2 倍，子项按键、值交替                      |
| 34  | *DATE          | `Date`，载荷为 8 字节 f64 毫秒时间戳                                |
| 35  | *REGEX         | `RegExp`，载荷为两段 `[len:varint][utf8]`，依次是 `source`、`flags` |
| 36  | *SYMBOL        | 无描述 `Symbol`，无载荷                                             |
| 37  | *SYMBOL_DESC   | 带描述 `Symbol`，载荷为描述                                         |
| 38  | *SYMBOL_GLOBAL | 全局 `Symbol`，载荷为描述，还原时走 `Symbol.for`                    |

注：
- `*` 表示可引用
- 15~28 的载荷统一为 `[offset:varint][byteLength:varint][bytes]`，只写视图覆盖的那段字节。`offset` 是原视图的偏移，解码时只读不用，还原出来的是从 0 开始的新视图
- `RegExp` 不保存 `lastIndex`
- 39~63 暂未使用

### 引用
可引用类型首次出现时按顺序编号，从 0 开始。同一个值再次出现，只写 `[POINTER][引用号]`。

解码端按同样顺序建表。标量读完整个值再入表；容器读完头部就建空壳入表，子项随后往壳里填，循环引用因此能解出来。

外部引用优先于内部引用，命中 `externalRefs` 的值只写 `[EXT_REF][索引]`，双方的列表必须一致。

数字、bigint、布尔值、`null`、`undefined` 和 `ARRAY_HOLE` 不可引用，每次都写完整帧。

## 编解码算法
使用 BFS。

编码先写根帧，再把遇到的容器放进队列。每从队列取出一个容器，就连续写出它的全部子项，子容器继续入队。解码也一样，读完容器头部就建空壳、入队，轮到它时按同样顺序填充。

帧之间不对齐，字节可以在任意位置切开、分块传输，解码只认帧序。

示例里 `DEF` 表示首次出现，写类型 ID 与载荷并登记引用；`REF` 表示指针；`ref` 是引用号。

源：
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

编码结果：
```
[VER][FLAG]
# 根对象
[DEF OBJECT ref=0 count=4]
  [DEF STRING ref=1 'k1']
  [DEF OBJECT ref=2 count=6]
  [DEF STRING ref=3 'k2']
  [REF 0]
# `k1` 对象的子项
  [REF 1]
  [VARINT 1]
  [REF 3]
  [VARINT 2]
  [DEF STRING ref=4 'k3']
  [REF 0]
```
