# obj-codec benchmark report

来源: `main.json`

| | |
| --- | --- |
| 时间 | 2026-10-30T03:06:58.728Z |
| Node | v24.16.0 |
| 平台 | linux 7.2.11-arch1-1 x64 |
| CPU | 13th Gen Intel(R) Core(TM) i7-13650HX |
| git | 8e5ce82 |
| 参数 | seed=1 time=250ms warmup=100ms iterations=2 timeout=30000ms |

口径：`ops/s` 来自 tinybench 的平均单次耗时（`1000/mean`），`MB/s` 用编码载荷字节数折算；`structuredClone` 不产生线格式，体积与解码列为空。S5 使用单发模式（每个 case 一次编码、一次解码），其 `ops/s` 是单次采样的倒数。

图表读法：所有排行图都按「越靠上越好」排序，标签前的数字是名次；`obj-codec` 用橙色标出，其余为蓝色。每节的完整数值收在折叠块里。

## 套件 S0

### 汇总（跨数据集几何均值）

![s0-summary](charts/s0-summary.svg)

<details>
<summary>汇总数值</summary>

| 库 | 编码 ops/s | 解码 ops/s | vs JSON (enc) | vs JSON (dec) | 参与数据集 | 失败 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 7,207 | 2,913 | 1.96x | 0.69x | 10 | 0 |
| msgpackr | 4,077 | 8,739 | 1.11x | 2.06x | 10 | 0 |
| cbor-x | 3,686 | 4,163 | 1.00x | 0.98x | 10 | 0 |
| json | 3,674 | 4,247 | 1.00x | 1.00x | 10 | 0 |
| structuredClone | 2,521 | - | 0.69x | - | 10 | 0 |
| obj-codec | 2,316 | 2,341 | 0.63x | 0.55x | 10 | 0 |
| seroval | 2,050 | 43,955 | 0.56x | 10.35x | 10 | 0 |
| msgpack | 1,804 | 3,870 | 0.49x | 0.91x | 10 | 0 |
| bson | 1,562 | 1,722 | 0.43x | 0.41x | 10 | 0 |
| flatted | 1,261 | 444 | 0.34x | 0.10x | 10 | 0 |
| ungap-structured-clone | 1,075 | 1,214 | 0.29x | 0.29x | 10 | 0 |
| devalue | 934 | 2,228 | 0.25x | 0.52x | 10 | 0 |
| turbo-stream | 913 | 533 | 0.25x | 0.13x | 10 | 0 |
| superjson | 320 | 4,261 | 0.09x | 1.00x | 10 | 0 |
| ion-js | 48 | 158 | 0.01x | 0.04x | 10 | 0 |
</details>

### 分数据集吞吐

<details>
<summary>分数据集明细（10 个数据集，各含图表与完整数值）</summary>

**A01-ints — 整数数组 1e4**

![A01-ints-throughput](charts/A01-ints-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cbor-x | 18,500 | 18,312 | 539.50 | 534.02 | 0.057 | 0.055 | 4625 | 1.0% | 1.18x |
| v8 | 17,256 | 8,379 | 514.53 | 249.85 | 0.059 | 0.114 | 4315 | 0.5% | 1.10x |
| msgpackr | 15,795 | 24,370 | 458.75 | 707.77 | 0.065 | 0.040 | 3949 | 1.4% | 1.00x |
| json | 15,731 | 19,301 | 734.17 | 900.78 | 0.070 | 0.051 | 3933 | 0.4% | 1.00x |
| msgpack | 13,851 | 20,214 | 399.60 | 583.20 | 0.076 | 0.048 | 3463 | 1.4% | 0.88x |
| obj-codec | 8,763 | 4,816 | 259.68 | 142.72 | 0.120 | 0.205 | 2191 | 2.4% | 0.56x |
| structuredClone | 6,797 | - | - | - | 0.148 | - | 1700 | 0.3% | 0.43x |
| seroval | 4,586 | 325,043 | 214.05 | 15170.10 | 0.209 | 0.003 | 1147 | 2.9% | 0.29x |
| flatted | 2,443 | 433 | 114.03 | 20.22 | 0.414 | 2.281 | 611 | 0.4% | 0.16x |
| bson | 1,985 | 7,510 | 196.36 | 742.81 | 0.515 | 0.129 | 497 | 1.0% | 0.13x |
| ungap-structured-clone | 1,718 | 1,742 | 141.67 | 143.65 | 0.530 | 0.549 | 430 | 3.5% | 0.11x |
| devalue | 1,693 | 5,583 | 111.79 | 368.76 | 0.550 | 0.178 | 424 | 3.1% | 0.11x |
| turbo-stream | 1,617 | 1,192 | 75.46 | 55.64 | 0.607 | 0.832 | 405 | 3.3% | 0.10x |
| superjson | 374 | 18,522 | 17.46 | 864.59 | 2.676 | 0.054 | 94 | 4.1% | 0.02x |
| ion-js | 35 | 154 | 1.04 | 4.51 | 34.142 | 6.337 | 9 | 18.1% | 0.00x |

**A02-floats — 浮点数组 1e4**

![A02-floats-throughput](charts/A02-floats-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 45,226 | 4,141 | 4070.71 | 372.74 | 0.021 | 0.176 | 11307 | 4.1% | 33.06x |
| msgpackr | 12,513 | 19,155 | 1126.24 | 1723.99 | 0.078 | 0.051 | 3129 | 0.9% | 9.15x |
| msgpack | 10,274 | 14,648 | 924.73 | 1318.34 | 0.095 | 0.066 | 2569 | 0.8% | 7.51x |
| cbor-x | 9,151 | 16,704 | 823.61 | 1503.42 | 0.107 | 0.059 | 2288 | 0.6% | 6.69x |
| structuredClone | 7,170 | - | - | - | 0.139 | - | 1793 | 0.5% | 5.24x |
| obj-codec | 6,830 | 2,006 | 614.89 | 180.60 | 0.131 | 0.511 | 1708 | 3.7% | 4.99x |
| bson | 2,023 | 6,002 | 281.06 | 833.69 | 0.505 | 0.164 | 506 | 0.8% | 1.48x |
| json | 1,368 | 3,191 | 259.13 | 604.44 | 0.732 | 0.316 | 343 | 0.9% | 1.00x |
| seroval | 1,207 | 60,415 | 228.58 | 11442.87 | 0.920 | 0.016 | 302 | 3.4% | 0.88x |
| flatted | 865 | 356 | 163.85 | 67.41 | 1.155 | 2.824 | 217 | 1.0% | 0.63x |
| turbo-stream | 776 | 299 | 147.02 | 56.60 | 1.346 | 3.329 | 195 | 3.3% | 0.57x |
| ungap-structured-clone | 514 | 650 | 143.14 | 180.93 | 2.071 | 1.469 | 129 | 3.6% | 0.38x |
| devalue | 450 | 1,762 | 107.19 | 419.77 | 2.106 | 0.558 | 113 | 5.1% | 0.33x |
| superjson | 272 | 3,192 | 51.48 | 604.66 | 3.758 | 0.315 | 68 | 4.0% | 0.20x |
| ion-js | 88 | 98 | 7.95 | 8.79 | 14.365 | 11.580 | 23 | 17.9% | 0.06x |

**A03-short-strings — 短字符串记录 2e3**

![A03-short-strings-throughput](charts/A03-short-strings-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| json | 3,942 | 2,988 | 620.22 | 470.07 | 0.250 | 0.333 | 986 | 1.5% | 1.00x |
| v8 | 3,461 | 1,615 | 468.53 | 218.64 | 0.306 | 0.597 | 866 | 3.3% | 0.88x |
| msgpackr | 1,345 | 5,643 | 103.72 | 435.32 | 0.750 | 0.170 | 337 | 0.6% | 0.34x |
| structuredClone | 1,317 | - | - | - | 0.748 | - | 330 | 0.7% | 0.33x |
| cbor-x | 1,014 | 1,862 | 124.86 | 229.31 | 0.991 | 0.527 | 254 | 0.6% | 0.26x |
| seroval | 973 | 31,819 | 132.62 | 4337.60 | 0.968 | 0.031 | 244 | 3.3% | 0.25x |
| obj-codec | 961 | 1,466 | 85.04 | 129.73 | 0.973 | 0.662 | 241 | 4.1% | 0.24x |
| flatted | 693 | 250 | 119.21 | 42.97 | 1.427 | 4.261 | 174 | 1.1% | 0.18x |
| bson | 676 | 995 | 111.07 | 163.56 | 1.483 | 1.017 | 169 | 1.1% | 0.17x |
| ungap-structured-clone | 646 | 752 | 103.86 | 120.96 | 1.673 | 1.280 | 162 | 3.9% | 0.16x |
| devalue | 622 | 1,648 | 100.79 | 267.07 | 1.615 | 0.612 | 156 | 3.7% | 0.16x |
| turbo-stream | 616 | 443 | 96.98 | 69.70 | 1.634 | 2.229 | 155 | 2.8% | 0.16x |
| msgpack | 540 | 1,656 | 64.32 | 197.13 | 1.898 | 0.604 | 136 | 2.1% | 0.14x |
| superjson | 295 | 3,044 | 46.39 | 479.01 | 3.361 | 0.329 | 74 | 4.2% | 0.07x |
| ion-js | 19 | 78 | 1.73 | 7.00 | 60.042 | 13.613 | 6 | 26.2% | 0.00x |

**A04-long-text — 长文本 1MB**

![A04-long-text-throughput](charts/A04-long-text-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| seroval | 27,365 | 7,256 | 26632.93 | 7061.52 | 0.036 | 0.137 | 6842 | 0.6% | 13.30x |
| v8 | 10,099 | 3,719 | 9828.71 | 3619.75 | 0.075 | 0.243 | 2525 | 4.2% | 4.91x |
| cbor-x | 8,896 | 4,098 | 8658.33 | 3988.44 | 0.080 | 0.215 | 2229 | 6.0% | 4.33x |
| msgpackr | 8,866 | 3,979 | 8629.19 | 3873.05 | 0.085 | 0.222 | 2217 | 5.8% | 4.31x |
| bson | 5,667 | 144 | 5515.09 | 140.49 | 0.266 | 7.010 | 1417 | 4.3% | 2.76x |
| structuredClone | 4,049 | - | - | - | 0.228 | - | 1013 | 1.8% | 1.97x |
| json | 2,057 | 2,792 | 2001.73 | 2716.85 | 0.482 | 0.339 | 515 | 1.3% | 1.00x |
| ungap-structured-clone | 2,011 | 2,788 | 1957.44 | 2713.46 | 0.491 | 0.338 | 503 | 1.4% | 0.98x |
| superjson | 1,969 | 2,828 | 1915.88 | 2752.39 | 0.507 | 0.332 | 493 | 1.7% | 0.96x |
| flatted | 1,359 | 2,747 | 1322.83 | 2673.22 | 0.828 | 0.349 | 341 | 1.7% | 0.66x |
| devalue | 1,134 | 2,784 | 1103.80 | 2709.54 | 0.846 | 0.338 | 284 | 2.1% | 0.55x |
| turbo-stream | 993 | 95 | 966.01 | 92.44 | 0.979 | 10.871 | 249 | 3.2% | 0.48x |
| obj-codec | 948 | 3,908 | 922.38 | 3803.08 | 1.141 | 0.232 | 237 | 4.3% | 0.46x |
| ion-js | 389 | 2,213 | 378.99 | 2153.84 | 2.619 | 0.418 | 98 | 3.2% | 0.19x |
| msgpack | 128 | 4,321 | 124.24 | 4205.88 | 7.872 | 0.211 | 32 | 0.5% | 0.06x |

**A05-wide-records — 重复 key 宽记录 1e3 x 20 字段**

![A05-wide-records-throughput](charts/A05-wide-records-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 1,110 | 1,003 | 316.02 | 285.54 | 0.900 | 0.987 | 278 | 0.9% | 1.12x |
| json | 994 | 1,092 | 321.30 | 352.96 | 1.005 | 0.917 | 249 | 1.0% | 1.00x |
| obj-codec | 722 | 627 | 87.24 | 75.74 | 1.361 | 1.555 | 181 | 4.1% | 0.73x |
| structuredClone | 547 | - | - | - | 1.824 | - | 137 | 0.6% | 0.55x |
| flatted | 526 | 148 | 168.02 | 47.35 | 1.885 | 6.953 | 132 | 0.9% | 0.53x |
| msgpackr | 461 | 2,000 | 40.00 | 173.70 | 2.182 | 0.493 | 116 | 0.7% | 0.46x |
| cbor-x | 376 | 476 | 95.26 | 120.57 | 2.674 | 2.110 | 95 | 0.6% | 0.38x |
| ungap-structured-clone | 350 | 380 | 64.41 | 69.91 | 2.888 | 2.563 | 88 | 6.4% | 0.35x |
| devalue | 334 | 662 | 94.79 | 187.80 | 3.233 | 1.485 | 84 | 5.6% | 0.34x |
| bson | 333 | 370 | 110.39 | 122.58 | 2.961 | 2.716 | 84 | 2.1% | 0.34x |
| seroval | 314 | 6,685 | 88.91 | 1894.07 | 3.392 | 0.145 | 79 | 4.4% | 0.32x |
| msgpack | 295 | 441 | 74.26 | 111.07 | 3.488 | 2.290 | 74 | 2.1% | 0.30x |
| turbo-stream | 271 | 160 | 87.62 | 51.58 | 3.691 | 6.404 | 68 | 2.5% | 0.27x |
| superjson | 95 | 1,131 | 30.86 | 365.82 | 10.338 | 0.885 | 24 | 5.1% | 0.10x |
| ion-js | 8 | 42 | 0.82 | 4.59 | 156.103 | 23.773 | 2 | 222.6% | 0.01x |

**A06-api-doc — 真实 API 文档（嵌套 5-8 层）**

![A06-api-doc-throughput](charts/A06-api-doc-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| json | 11,116 | 5,961 | 665.83 | 357.06 | 0.090 | 0.168 | 2779 | 0.2% | 1.00x |
| v8 | 6,886 | 2,974 | 376.30 | 162.54 | 0.147 | 0.316 | 1722 | 3.2% | 0.62x |
| msgpackr | 2,804 | 14,741 | 79.24 | 416.51 | 0.354 | 0.065 | 702 | 0.7% | 0.25x |
| cbor-x | 2,417 | 4,978 | 117.52 | 242.05 | 0.415 | 0.200 | 605 | 0.5% | 0.22x |
| structuredClone | 2,389 | - | - | - | 0.410 | - | 598 | 1.2% | 0.21x |
| obj-codec | 2,014 | 3,627 | 71.48 | 128.72 | 0.470 | 0.261 | 504 | 3.0% | 0.18x |
| seroval | 1,946 | 56,350 | 103.01 | 2982.80 | 0.499 | 0.017 | 487 | 1.9% | 0.18x |
| bson | 1,734 | 2,106 | 111.17 | 135.01 | 0.571 | 0.467 | 434 | 1.1% | 0.16x |
| devalue | 1,612 | 3,428 | 108.22 | 230.20 | 0.582 | 0.289 | 403 | 2.4% | 0.14x |
| ungap-structured-clone | 1,481 | 1,580 | 101.91 | 108.71 | 0.663 | 0.614 | 371 | 3.2% | 0.13x |
| flatted | 1,421 | 511 | 103.22 | 37.11 | 0.695 | 1.940 | 356 | 0.8% | 0.13x |
| msgpack | 1,396 | 4,177 | 64.34 | 192.45 | 0.725 | 0.235 | 350 | 1.5% | 0.13x |
| turbo-stream | 1,294 | 787 | 77.54 | 47.17 | 0.790 | 1.262 | 325 | 1.9% | 0.12x |
| superjson | 642 | 5,989 | 38.47 | 358.82 | 1.525 | 0.168 | 161 | 2.7% | 0.06x |
| ion-js | 56 | 176 | 1.88 | 5.93 | 22.380 | 6.150 | 14 | 17.7% | 0.01x |

**A07-deep-chain — 深链 1e3**

![A07-deep-chain-throughput](charts/A07-deep-chain-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| msgpackr | 14,570 | 44,328 | 54.07 | 164.50 | 0.067 | 0.022 | 3643 | 0.6% | 3.85x |
| v8 | 11,792 | 4,488 | 223.33 | 85.00 | 0.085 | 0.221 | 2948 | 5.8% | 3.11x |
| cbor-x | 10,134 | 5,827 | 169.48 | 97.45 | 0.097 | 0.171 | 2534 | 0.7% | 2.68x |
| msgpack | 5,887 | 8,394 | 86.06 | 122.72 | 0.166 | 0.119 | 1472 | 1.6% | 1.55x |
| bson | 4,941 | 4,953 | 108.75 | 109.02 | 0.198 | 0.197 | 1236 | 0.8% | 1.31x |
| obj-codec | 4,923 | 5,972 | 43.85 | 53.19 | 0.193 | 0.164 | 1231 | 1.8% | 1.30x |
| seroval | 4,093 | 87,731 | 69.16 | 1482.39 | 0.232 | 0.012 | 1024 | 1.4% | 1.08x |
| json | 3,786 | 10,821 | 79.12 | 226.12 | 0.266 | 0.093 | 947 | 0.2% | 1.00x |
| structuredClone | 3,729 | - | - | - | 0.265 | - | 933 | 0.5% | 0.98x |
| flatted | 3,352 | 1,190 | 89.79 | 31.88 | 0.294 | 0.834 | 839 | 0.5% | 0.89x |
| devalue | 3,179 | 4,662 | 94.71 | 138.88 | 0.293 | 0.214 | 795 | 2.1% | 0.84x |
| ungap-structured-clone | 2,962 | 2,683 | 91.33 | 82.75 | 0.314 | 0.366 | 741 | 2.5% | 0.78x |
| turbo-stream | 2,594 | 2,194 | 54.22 | 45.84 | 0.374 | 0.448 | 649 | 1.7% | 0.69x |
| superjson | 147 | 11,453 | 3.08 | 239.44 | 7.417 | 0.086 | 37 | 10.7% | 0.04x |
| ion-js | 80 | 397 | 0.62 | 3.08 | 17.611 | 2.340 | 20 | 19.1% | 0.02x |

**A08-wide-object — 宽对象 2e3 key**

![A08-wide-object-throughput](charts/A08-wide-object-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 6,205 | 3,750 | 179.91 | 108.73 | 0.165 | 0.249 | 1552 | 0.5% | 1.06x |
| json | 5,855 | 4,722 | 195.99 | 158.04 | 0.173 | 0.212 | 1464 | 0.3% | 1.00x |
| flatted | 4,366 | 1,089 | 129.62 | 32.34 | 0.233 | 0.922 | 1092 | 0.4% | 0.75x |
| bson | 3,119 | 3,483 | 103.12 | 115.14 | 0.322 | 0.284 | 780 | 0.7% | 0.53x |
| cbor-x | 3,046 | 4,080 | 78.80 | 105.52 | 0.330 | 0.244 | 762 | 0.5% | 0.52x |
| seroval | 2,924 | 126,779 | 86.19 | 3736.68 | 0.340 | 0.007 | 732 | 0.8% | 0.50x |
| structuredClone | 2,597 | - | - | - | 0.381 | - | 650 | 1.6% | 0.44x |
| turbo-stream | 2,404 | 1,656 | 80.45 | 55.45 | 0.411 | 0.602 | 601 | 1.3% | 0.41x |
| msgpack | 2,401 | 1,357 | 62.00 | 35.05 | 0.416 | 0.730 | 601 | 1.2% | 0.41x |
| msgpackr | 2,186 | 4,018 | 56.51 | 103.86 | 0.464 | 0.246 | 547 | 0.4% | 0.37x |
| obj-codec | 1,920 | 2,253 | 45.89 | 53.84 | 0.513 | 0.436 | 480 | 2.0% | 0.33x |
| devalue | 1,764 | 2,389 | 56.38 | 76.34 | 0.594 | 0.415 | 444 | 4.0% | 0.30x |
| ungap-structured-clone | 1,701 | 1,680 | 98.89 | 97.68 | 0.544 | 0.575 | 426 | 3.1% | 0.29x |
| superjson | 985 | 4,655 | 32.97 | 155.86 | 1.057 | 0.215 | 247 | 2.1% | 0.17x |
| ion-js | 71 | 360 | 2.13 | 10.72 | 19.268 | 2.762 | 18 | 17.9% | 0.01x |

**A09-mixed-payload — 混合真实 payload 约 1MB**

![A09-mixed-payload-throughput](charts/A09-mixed-payload-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 910 | 505 | 375.63 | 208.53 | 1.039 | 1.929 | 228 | 12.9% | 1.52x |
| msgpackr | 669 | 1,669 | 154.95 | 386.54 | 1.530 | 0.570 | 168 | 1.8% | 1.12x |
| json | 600 | 651 | 353.63 | 384.12 | 1.667 | 1.539 | 150 | 0.8% | 1.00x |
| cbor-x | 510 | 523 | 187.34 | 192.13 | 2.002 | 1.914 | 128 | 0.7% | 0.85x |
| structuredClone | 409 | - | - | - | 2.468 | - | 103 | 0.6% | 0.68x |
| obj-codec | 321 | 393 | 90.66 | 111.12 | 3.182 | 2.486 | 81 | 5.3% | 0.53x |
| bson | 278 | 348 | 133.58 | 167.28 | 3.561 | 2.893 | 70 | 2.6% | 0.46x |
| msgpack | 267 | 733 | 96.10 | 263.43 | 3.696 | 1.319 | 67 | 4.0% | 0.45x |
| seroval | 200 | 5,475 | 108.10 | 2961.05 | 5.118 | 0.169 | 51 | 3.0% | 0.33x |
| flatted | 187 | 63 | 119.35 | 40.13 | 5.349 | 16.900 | 47 | 2.0% | 0.31x |
| turbo-stream | 123 | 77 | 72.63 | 45.45 | 8.181 | 13.923 | 31 | 5.6% | 0.21x |
| ungap-structured-clone | 110 | 147 | 82.10 | 110.19 | 10.206 | 5.996 | 28 | 6.9% | 0.18x |
| devalue | 102 | 328 | 71.47 | 230.67 | 10.511 | 3.301 | 26 | 7.9% | 0.17x |
| superjson | 54 | 650 | 31.92 | 383.25 | 20.042 | 1.539 | 14 | 7.2% | 0.09x |
| ion-js | 6 | 21 | 1.58 | 5.44 | 173.548 | 47.315 | 2 | 61.0% | 0.01x |

**A10-bool-null — 布尔/null 密集 1e4**

![A10-bool-null-throughput](charts/A10-bool-null-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME | 相对 JSON (enc) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 27,259 | 8,334 | 272.83 | 83.42 | 0.038 | 0.116 | 6815 | 0.6% | 1.56x |
| msgpack | 23,878 | 23,116 | 238.86 | 231.23 | 0.043 | 0.042 | 5970 | 1.6% | 1.37x |
| cbor-x | 21,169 | 22,740 | 211.76 | 227.47 | 0.047 | 0.044 | 5293 | 0.9% | 1.21x |
| msgpackr | 19,544 | 28,291 | 195.50 | 282.99 | 0.052 | 0.035 | 4887 | 0.8% | 1.12x |
| obj-codec | 18,505 | 7,427 | 185.46 | 74.43 | 0.056 | 0.133 | 4627 | 1.9% | 1.06x |
| json | 17,487 | 17,181 | 932.63 | 916.36 | 0.057 | 0.059 | 4372 | 0.3% | 1.00x |
| structuredClone | 7,718 | - | - | - | 0.130 | - | 1930 | 0.4% | 0.44x |
| ungap-structured-clone | 6,242 | 7,348 | 125.05 | 147.21 | 0.154 | 0.129 | 1561 | 1.4% | 0.36x |
| seroval | 6,084 | 258,880 | 223.10 | 9492.36 | 0.168 | 0.004 | 1522 | 1.1% | 0.35x |
| devalue | 3,075 | 8,056 | 61.56 | 161.28 | 0.301 | 0.123 | 769 | 3.5% | 0.18x |
| flatted | 2,493 | 454 | 132.99 | 24.22 | 0.407 | 2.191 | 624 | 0.4% | 0.14x |
| bson | 2,276 | 7,559 | 149.26 | 495.62 | 0.444 | 0.127 | 570 | 1.4% | 0.13x |
| turbo-stream | 1,950 | 3,538 | 104.03 | 188.72 | 0.481 | 0.281 | 488 | 3.6% | 0.11x |
| superjson | 397 | 16,511 | 21.16 | 880.74 | 2.546 | 0.061 | 100 | 4.1% | 0.02x |
| ion-js | 180 | 164 | 1.80 | 1.64 | 6.084 | 5.943 | 45 | 5.6% | 0.01x |

</details>

### 载荷体积

![s0-payload-size](charts/s0-payload-size.svg)

<details>
<summary>全部库的载荷体积（14 个库）</summary>

| 数据集 | json | v8 | cbor-x | msgpack | msgpackr | superjson | devalue | seroval | turbo-stream | flatted | ungap-structured-clone | bson | ion-js | obj-codec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A01-ints | 46KB | 29KB | 28KB | 28KB | 28KB | 46KB | 65KB | 46KB | 46KB | 46KB | 81KB | 97KB | 29KB | 29KB |
| A02-floats | 185KB | 88KB | 88KB | 88KB | 88KB | 185KB | 233KB | 185KB | 185KB | 185KB | 272KB | 136KB | 88KB | 88KB |
| A03-short-strings | 154KB | 132KB | 120KB | 116KB | 75KB | 154KB | 158KB | 133KB | 154KB | 168KB | 157KB | 160KB | 87KB | 86KB |
| A04-long-text | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB | 950KB |
| A05-wide-records | 316KB | 278KB | 247KB | 246KB | 85KB | 316KB | 277KB | 277KB | 316KB | 312KB | 180KB | 324KB | 106KB | 118KB |
| A06-api-doc | 58KB | 53KB | 47KB | 45KB | 28KB | 59KB | 66KB | 52KB | 58KB | 71KB | 67KB | 63KB | 33KB | 35KB |
| A07-deep-chain | 20KB | 18KB | 16KB | 14KB | 3.6KB | 20KB | 29KB | 17KB | 20KB | 26KB | 30KB | 21KB | 7.6KB | 8.7KB |
| A08-wide-object | 33KB | 28KB | 25KB | 25KB | 25KB | 33KB | 31KB | 29KB | 33KB | 29KB | 57KB | 32KB | 29KB | 23KB |
| A09-mixed-payload | 576KB | 403KB | 359KB | 351KB | 226KB | 576KB | 687KB | 528KB | 576KB | 624KB | 731KB | 469KB | 256KB | 276KB |
| A10-bool-null | 52KB | 9.8KB | 9.8KB | 9.8KB | 9.8KB | 52KB | 20KB | 36KB | 52KB | 52KB | 20KB | 64KB | 9.8KB | 9.8KB |

gzip (level 9) 后体积：

| 数据集 | json | v8 | cbor-x | msgpack | msgpackr | superjson | devalue | seroval | turbo-stream | flatted | ungap-structured-clone | bson | ion-js | obj-codec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A01-ints | 9.0KB | 8.7KB | 8.5KB | 8.4KB | 8.4KB | 9.0KB | 9.2KB | 9.0KB | 9.0KB | 9.0KB | 20KB | 29KB | 8.5KB | 8.6KB |
| A02-floats | 89KB | 60KB | 60KB | 60KB | 60KB | 89KB | 111KB | 89KB | 89KB | 89KB | 116KB | 80KB | 60KB | 60KB |
| A03-short-strings | 17KB | 18KB | 17KB | 17KB | 16KB | 17KB | 34KB | 17KB | 17KB | 27KB | 33KB | 25KB | 18KB | 17KB |
| A04-long-text | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB | 115KB |
| A05-wide-records | 49KB | 50KB | 48KB | 48KB | 31KB | 49KB | 49KB | 48KB | 49KB | 50KB | 48KB | 58KB | 44KB | 43KB |
| A06-api-doc | 7.9KB | 8.2KB | 7.9KB | 7.8KB | 7.3KB | 7.9KB | 16KB | 7.8KB | 7.9KB | 13KB | 16KB | 9.7KB | 8.6KB | 7.5KB |
| A07-deep-chain | 2.3KB | 1.8KB | 2.2KB | 2.0KB | 2.4KB | 2.3KB | 7.2KB | 2.2KB | 2.3KB | 4.7KB | 7.1KB | 3.8KB | 4.3KB | 1.8KB |
| A08-wide-object | 8.5KB | 7.0KB | 7.4KB | 7.4KB | 7.8KB | 8.5KB | 10KB | 8.2KB | 8.5KB | 8.3KB | 16KB | 7.8KB | 12KB | 6.8KB |
| A09-mixed-payload | 179KB | 132KB | 130KB | 130KB | 123KB | 179KB | 260KB | 177KB | 179KB | 191KB | 265KB | 143KB | 129KB | 118KB |
| A10-bool-null | 158B | 61B | 52B | 53B | 53B | 171B | 91B | 122B | 160B | 159B | 98B | 24KB | 59B | 76B |

</details>

### 内存（子进程，GC 后采样）

![s0-memory-encode-peak](charts/s0-memory-encode-peak.svg)

<details>
<summary>全部内存采样</summary>

| 数据集 | 库 | 编码峰值堆 | 解码峰值堆 | 结果常驻 | 进程 maxRSS |
| --- | --- | ---: | ---: | ---: | ---: |
| A01-ints | json | 50KB | 82KB | 106KB | 120MB |
| A01-ints | v8 | 4.9KB | 82KB | 60KB | 122MB |
| A01-ints | structuredClone | 83KB | 3.6KB | 63KB | 120MB |
| A01-ints | superjson | 4.0MB | 84KB | 118KB | 128MB |
| A01-ints | cbor-x | 398KB | 82KB | 61KB | 120MB |
| A01-ints | msgpackr | 20KB | 88KB | 62KB | 121MB |
| A01-ints | msgpack | 407KB | 85KB | 59KB | 122MB |
| A01-ints | devalue | 3.8MB | 291KB | 126KB | 123MB |
| A01-ints | seroval | 1.3MB | 134KB | 113KB | 121MB |
| A01-ints | turbo-stream | 3.3MB | 930KB | 152KB | 129MB |
| A01-ints | flatted | 298KB | 1.4MB | 107KB | 121MB |
| A01-ints | ungap-structured-clone | 2.4MB | 1.9MB | 747KB | 124MB |
| A01-ints | bson | 258KB | 275KB | 96KB | 124MB |
| A01-ints | ion-js | 15MB | 6.8MB | 31KB | 154MB |
| A01-ints | obj-codec | 165KB | 265KB | 44KB | 122MB |
| A02-floats | json | 190KB | 82KB | 244KB | 122MB |
| A02-floats | v8 | 4.9KB | 239KB | 216KB | 119MB |
| A02-floats | structuredClone | 240KB | 3.6KB | 216KB | 121MB |
| A02-floats | superjson | 4.7MB | 84KB | 257KB | 128MB |
| A02-floats | cbor-x | 614KB | 317KB | 61KB | 123MB |
| A02-floats | msgpackr | 244KB | 323KB | 58KB | 121MB |
| A02-floats | msgpack | 569KB | 330KB | 51KB | 123MB |
| A02-floats | devalue | 5.7MB | 826KB | 683KB | 126MB |
| A02-floats | seroval | 2.1MB | 352KB | 330KB | 124MB |
| A02-floats | turbo-stream | 3.6MB | 5.5MB | 306KB | 138MB |
| A02-floats | flatted | 586KB | 2.4MB | 245KB | 124MB |
| A02-floats | ungap-structured-clone | 4.9MB | 4.0MB | 332KB | 128MB |
| A02-floats | bson | 417KB | 529KB | 71KB | 124MB |
| A02-floats | ion-js | 12MB | 11MB | 30KB | 146MB |
| A02-floats | obj-codec | 187KB | 1.5MB | 52KB | 124MB |
| A03-short-strings | json | 158KB | 274KB | 393KB | 123MB |
| A03-short-strings | v8 | 4.9KB | 472KB | 246KB | 123MB |
| A03-short-strings | structuredClone | 473KB | 3.6KB | 248KB | 123MB |
| A03-short-strings | superjson | 5.1MB | 276KB | 412KB | 131MB |
| A03-short-strings | cbor-x | 726KB | 588KB | 362KB | 122MB |
| A03-short-strings | msgpackr | 217KB | 351KB | 295KB | 124MB |
| A03-short-strings | msgpack | 742KB | 1.7MB | 231KB | 125MB |
| A03-short-strings | devalue | 4.3MB | 1.2MB | 570KB | 129MB |
| A03-short-strings | seroval | 2.5MB | 502KB | 457KB | 129MB |
| A03-short-strings | turbo-stream | 4.5MB | 2.7MB | 971KB | 136MB |
| A03-short-strings | flatted | 1.4MB | 3.0MB | 641KB | 126MB |
| A03-short-strings | ungap-structured-clone | 5.4MB | 4.1MB | 351KB | 130MB |
| A03-short-strings | bson | 586KB | 2.8MB | 268KB | 127MB |
| A03-short-strings | ion-js | 18MB | 17MB | 626KB | 194MB |
| A03-short-strings | obj-codec | 2.5MB | 1.1MB | 146KB | 127MB |
| A04-long-text | json | 955KB | 954KB | 1.8MB | 134MB |
| A04-long-text | v8 | 4.9KB | 955KB | 932KB | 136MB |
| A04-long-text | structuredClone | 956KB | 3.6KB | 932KB | 131MB |
| A04-long-text | superjson | 963KB | 956KB | 1.8MB | 134MB |
| A04-long-text | cbor-x | 11KB | 998KB | 981KB | 135MB |
| A04-long-text | msgpackr | 11KB | 993KB | 975KB | 136MB |
| A04-long-text | msgpack | 17KB | 977KB | 947KB | 132MB |
| A04-long-text | devalue | 959KB | 1.9MB | 1.8MB | 135MB |
| A04-long-text | seroval | 20KB | 957KB | 931KB | 134MB |
| A04-long-text | turbo-stream | 1.9MB | 30MB | 31MB | 185MB |
| A04-long-text | flatted | 1.9MB | 1.9MB | 1.8MB | 135MB |
| A04-long-text | ungap-structured-clone | 958KB | 957KB | 1.8MB | 135MB |
| A04-long-text | bson | 33KB | 973KB | 961KB | 134MB |
| A04-long-text | ion-js | 68KB | 992KB | 967KB | 135MB |
| A04-long-text | obj-codec | 30KB | 983KB | 955KB | 135MB |
| A05-wide-records | json | 664KB | 191KB | 484KB | 128MB |
| A05-wide-records | v8 | 349KB | 540KB | 430KB | 126MB |
| A05-wide-records | structuredClone | 887KB | 3.6KB | 422KB | 127MB |
| A05-wide-records | superjson | 4.3MB | 193KB | 480KB | 134MB |
| A05-wide-records | cbor-x | 1.9MB | 2.2MB | 1.0MB | 134MB |
| A05-wide-records | msgpackr | 809KB | 544KB | 399KB | 128MB |
| A05-wide-records | msgpack | 1.3MB | 3.2MB | 1.0MB | 134MB |
| A05-wide-records | devalue | 5.8MB | 2.8MB | 1.1MB | 136MB |
| A05-wide-records | seroval | 4.8MB | 835KB | 810KB | 133MB |
| A05-wide-records | turbo-stream | 7.9MB | 5.7MB | 1.4MB | 146MB |
| A05-wide-records | flatted | 1.2MB | 3.8MB | 621KB | 131MB |
| A05-wide-records | ungap-structured-clone | 5.6MB | 6.6MB | 1008KB | 136MB |
| A05-wide-records | bson | 631KB | 7.2MB | 1.1MB | 138MB |
| A05-wide-records | ion-js | 31MB | 28MB | 994KB | 308MB |
| A05-wide-records | obj-codec | 2.2MB | 1.6MB | 806KB | 131MB |
| A06-api-doc | json | 63KB | 123KB | 160KB | 123MB |
| A06-api-doc | v8 | 4.9KB | 266KB | 137KB | 123MB |
| A06-api-doc | structuredClone | 288KB | 3.6KB | 145KB | 121MB |
| A06-api-doc | superjson | 5.9MB | 127KB | 161KB | 128MB |
| A06-api-doc | cbor-x | 273KB | 262KB | 144KB | 121MB |
| A06-api-doc | msgpackr | 188KB | 199KB | 113KB | 122MB |
| A06-api-doc | msgpack | 379KB | 1.2MB | 59KB | 123MB |
| A06-api-doc | devalue | 1.8MB | 610KB | 177KB | 123MB |
| A06-api-doc | seroval | 1.1MB | 244KB | 217KB | 124MB |
| A06-api-doc | turbo-stream | 2.0MB | 1.4MB | 671KB | 136MB |
| A06-api-doc | flatted | 847KB | 1.5MB | 169KB | 124MB |
| A06-api-doc | ungap-structured-clone | 2.6MB | 1.9MB | 237KB | 124MB |
| A06-api-doc | bson | 428KB | 1.2MB | 193KB | 126MB |
| A06-api-doc | ion-js | 15MB | 7.7MB | 345KB | 167MB |
| A06-api-doc | obj-codec | 1.4MB | 691KB | 130KB | 122MB |
| A07-deep-chain | json | 25KB | 43KB | 41KB | 122MB |
| A07-deep-chain | v8 | 4.9KB | 155KB | 36KB | 122MB |
| A07-deep-chain | structuredClone | 161KB | 3.6KB | 36KB | 122MB |
| A07-deep-chain | superjson | 23MB | 45KB | 39KB | 155MB |
| A07-deep-chain | cbor-x | 182KB | 132KB | 43KB | 122MB |
| A07-deep-chain | msgpackr | 92KB | 48KB | 20KB | 122MB |
| A07-deep-chain | msgpack | 236KB | 355KB | 35KB | 123MB |
| A07-deep-chain | devalue | 1.1MB | 385KB | 67KB | 122MB |
| A07-deep-chain | seroval | 773KB | 129KB | 112KB | 122MB |
| A07-deep-chain | turbo-stream | 1.1MB | 414KB | 90KB | 129MB |
| A07-deep-chain | flatted | 289KB | 748KB | 130KB | 121MB |
| A07-deep-chain | ungap-structured-clone | 1.7MB | 1.2MB | 55KB | 123MB |
| A07-deep-chain | bson | 255KB | 651KB | 15KB | 121MB |
| A07-deep-chain | ion-js | 5.1MB | 4.4MB | -111000B | 151MB |
| A07-deep-chain | obj-codec | 732KB | 286KB | 17KB | 121MB |
| A08-wide-object | json | 69KB | 100KB | 110KB | 121MB |
| A08-wide-object | v8 | 36KB | 1.8MB | 100KB | 122MB |
| A08-wide-object | structuredClone | 1.8MB | 3.6KB | 99KB | 124MB |
| A08-wide-object | superjson | 2.6MB | 120KB | 117KB | 123MB |
| A08-wide-object | cbor-x | 207KB | 380KB | 95KB | 122MB |
| A08-wide-object | msgpackr | 84KB | 371KB | 108KB | 120MB |
| A08-wide-object | msgpack | 119KB | 2.6MB | 91KB | 124MB |
| A08-wide-object | devalue | 1.2MB | 488KB | 109KB | 124MB |
| A08-wide-object | seroval | 498KB | 169KB | 137KB | 121MB |
| A08-wide-object | turbo-stream | 948KB | 799KB | 184KB | 130MB |
| A08-wide-object | flatted | 100KB | 481KB | 106KB | 121MB |
| A08-wide-object | ungap-structured-clone | 1.9MB | 1.5MB | 135KB | 123MB |
| A08-wide-object | bson | 61KB | 850KB | 104KB | 124MB |
| A08-wide-object | ion-js | 5.7MB | 5.1MB | -30032B | 150MB |
| A08-wide-object | obj-codec | 706KB | 785KB | 53KB | 122MB |
| A09-mixed-payload | json | 581KB | 734KB | 1.3MB | 135MB |
| A09-mixed-payload | v8 | 4.9KB | 1.6MB | 1.1MB | 133MB |
| A09-mixed-payload | structuredClone | 1.6MB | 3.6KB | 1.0MB | 133MB |
| A09-mixed-payload | superjson | 5.3MB | 736KB | 1.3MB | 156MB |
| A09-mixed-payload | cbor-x | 2.4MB | 2.2MB | 1.3MB | 136MB |
| A09-mixed-payload | msgpackr | 842KB | 1.2MB | 1.1MB | 133MB |
| A09-mixed-payload | msgpack | 2.8MB | 2.8MB | 1.0MB | 135MB |
| A09-mixed-payload | devalue | 15MB | 4.3MB | 1.6MB | 154MB |
| A09-mixed-payload | seroval | 8.8MB | 1.9MB | 1.9MB | 145MB |
| A09-mixed-payload | turbo-stream | 13MB | 13MB | 2.7MB | 155MB |
| A09-mixed-payload | flatted | 3.8MB | 10MB | 2.0MB | 143MB |
| A09-mixed-payload | ungap-structured-clone | 17MB | 16MB | 2.0MB | 161MB |
| A09-mixed-payload | bson | 1.8MB | 8.0MB | 1.4MB | 140MB |
| A09-mixed-payload | ion-js | 51MB | 50MB | 2.0MB | 360MB |
| A09-mixed-payload | obj-codec | 5.4MB | 4.6MB | 1.3MB | 137MB |
| A10-bool-null | json | 57KB | 82KB | 111KB | 122MB |
| A10-bool-null | v8 | 4.9KB | 82KB | 60KB | 121MB |
| A10-bool-null | structuredClone | 83KB | 3.6KB | 58KB | 123MB |
| A10-bool-null | superjson | 3.8MB | 84KB | 125KB | 128MB |
| A10-bool-null | cbor-x | 395KB | 100KB | 59KB | 122MB |
| A10-bool-null | msgpackr | 7.8KB | 100KB | 63KB | 120MB |
| A10-bool-null | msgpack | 405KB | 94KB | 66KB | 121MB |
| A10-bool-null | devalue | 2.5MB | 182KB | 80KB | 123MB |
| A10-bool-null | seroval | 654KB | 120KB | 95KB | 122MB |
| A10-bool-null | turbo-stream | 3.0MB | 302KB | 163KB | 128MB |
| A10-bool-null | flatted | 302KB | 1.1MB | 113KB | 121MB |
| A10-bool-null | ungap-structured-clone | 648KB | 723KB | 79KB | 121MB |
| A10-bool-null | bson | 258KB | 255KB | 58KB | 122MB |
| A10-bool-null | ion-js | 7.4MB | 6.2MB | 28KB | 128MB |
| A10-bool-null | obj-codec | 27KB | 247KB | 49KB | 121MB |

</details>

## 套件 S1

### 汇总（跨数据集几何均值）

![s1-summary](charts/s1-summary.svg)

<details>
<summary>汇总数值</summary>

| 库 | 编码 ops/s | 解码 ops/s | 参与数据集 | 失败 |
| --- | ---: | ---: | ---: | ---: |
| v8 | 7,575 | 7,634 | 7 | 0 |
| structuredClone | 3,364 | - | 7 | 0 |
| msgpackr | 3,314 | 5,864 | 5 | 0 |
| obj-codec | 2,329 | 2,620 | 7 | 0 |
| cbor-x | 2,009 | 11,853 | 4 | 1 |
| seroval | 1,297 | 4,272 | 6 | 1 |
| devalue | 1,214 | 1,882 | 7 | 0 |
| msgpack | 682 | 38,186 | 2 | 1 |
| turbo-stream | 601 | 246 | 7 | 0 |
| bson | 523 | 623 | 1 | 0 |
| ungap-structured-clone | 334 | 645 | 4 | 0 |
| ion-js | 160 | 271 | 2 | 0 |
| superjson | 99 | 299 | 5 | 0 |
</details>

### 分数据集吞吐

<details>
<summary>分数据集明细（7 个数据集，各含图表与完整数值）</summary>

**B01-bigint — BigInt 数组（含 >64bit）3e3**

![B01-bigint-throughput](charts/B01-bigint-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 28,600 | 9,526 | 1044.51 | 347.91 | 0.037 | 0.085 | 7151 | 2.0% |
| structuredClone | 10,412 | - | - | - | 0.096 | - | 2604 | 0.4% |
| ungap-structured-clone | 7,476 | 14,425 | 75.77 | 146.20 | 0.130 | 0.068 | 1869 | 0.8% |
| seroval | 6,354 | 52,699 | 335.81 | 2784.94 | 0.151 | 0.020 | 1589 | 1.2% |
| devalue | 5,687 | 19,204 | 60.24 | 203.43 | 0.167 | 0.052 | 1422 | 1.9% |
| turbo-stream | 3,486 | 1,056 | 184.21 | 55.78 | 0.282 | 0.958 | 872 | 1.2% |
| msgpackr | 1,152 | 6,387 | 40.07 | 222.27 | 1.175 | 0.152 | 288 | 5.2% |
| cbor-x | 1,142 | 4,026 | 35.56 | 125.36 | 1.202 | 0.242 | 286 | 5.5% |
| obj-codec | 1,135 | 2,195 | 29.26 | 56.57 | 0.868 | 0.464 | 284 | 2.1% |
| superjson | 537 | 702 | 69.16 | 90.37 | 1.929 | 1.352 | 135 | 2.4% |

**B02-date — Date 密集 3e3**

![B02-date-throughput](charts/B02-date-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 1,212 | 674 | 265.63 | 147.68 | 0.738 | 1.352 | 307 | 17.0% |
| cbor-x | 838 | 904 | 168.55 | 181.89 | 1.212 | 1.092 | 210 | 0.9% |
| msgpackr | 671 | 1,573 | 66.61 | 156.12 | 1.507 | 0.611 | 168 | 3.0% |
| obj-codec | 661 | 701 | 87.32 | 92.58 | 1.477 | 1.415 | 166 | 4.3% |
| structuredClone | 576 | - | - | - | 1.744 | - | 144 | 1.8% |
| bson | 523 | 623 | 126.75 | 150.80 | 1.914 | 1.660 | 131 | 0.7% |
| seroval | 146 | 569 | 67.18 | 261.08 | 7.422 | 1.607 | 37 | 4.1% |
| devalue | 145 | 325 | 75.50 | 169.34 | 7.010 | 3.052 | 37 | 6.3% |
| ungap-structured-clone | 132 | 252 | 54.71 | 104.69 | 8.372 | 3.820 | 33 | 4.6% |
| msgpack | 117 | 615 | 22.79 | 120.13 | 10.519 | 1.611 | 30 | 11.2% |
| turbo-stream | 107 | 108 | 43.10 | 43.38 | 9.277 | 9.794 | 27 | 3.5% |
| superjson | 47 | 113 | 28.61 | 69.34 | 22.135 | 9.274 | 12 | 6.1% |
| ion-js | 8 | 25 | 1.07 | 3.42 | 134.552 | 43.592 | 2 | 65.0% |

**B03-collections — Map/Set 密集 2e3 项**

![B03-collections-throughput](charts/B03-collections-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 10,829 | 1,699 | 789.73 | 123.89 | 0.091 | 0.551 | 2708 | 0.5% |
| msgpackr | 2,226 | 2,706 | 152.25 | 185.09 | 0.448 | 0.367 | 557 | 0.8% |
| cbor-x | 2,076 | 2,511 | 142.08 | 171.87 | 0.480 | 0.392 | 519 | 0.8% |
| seroval | 1,849 | 5,032 | 176.89 | 481.51 | 0.487 | 0.197 | 463 | 3.0% |
| structuredClone | 1,848 | - | - | - | 0.533 | - | 463 | 0.6% |
| obj-codec | 1,166 | 1,008 | 83.13 | 71.88 | 0.821 | 0.966 | 292 | 2.7% |
| devalue | 653 | 1,554 | 87.66 | 208.50 | 1.372 | 0.631 | 164 | 4.9% |
| ungap-structured-clone | 516 | 585 | 93.59 | 106.20 | 2.066 | 1.642 | 130 | 4.4% |
| turbo-stream | 501 | 400 | 47.89 | 38.24 | 2.126 | 2.575 | 126 | 3.0% |
| superjson | 136 | 1,592 | 12.99 | 152.41 | 8.770 | 0.625 | 35 | 7.2% |

**B04-binary — 二进制载荷 1MB Uint8Array**

![B04-binary-throughput](charts/B04-binary-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 9,212 | 892,896 | 9659.48 | 936293.82 | 0.082 | 0.001 | 2303 | 4.3% |
| msgpackr | 8,521 | 8,392 | 8935.07 | 8799.96 | 0.085 | 0.104 | 2131 | 4.2% |
| cbor-x | 8,199 | 2,159,212 | 8597.94 | 2264151.51 | 0.086 | 0.000 | 2050 | 4.8% |
| obj-codec | 6,803 | 7,552 | 7133.48 | 7919.46 | 0.116 | 0.111 | 1701 | 4.3% |
| structuredClone | 6,540 | - | - | - | 0.120 | - | 1645 | 4.6% |
| msgpack | 3,989 | 2,369,498 | 4182.60 | 2484648.27 | 0.272 | 0.000 | 998 | 4.8% |
| ion-js | 3,287 | 2,954 | 3446.39 | 3097.89 | 0.253 | 0.274 | 822 | 5.2% |
| devalue | 1,715 | 1,171 | 2398.24 | 1637.17 | 0.534 | 0.772 | 429 | 6.0% |
| turbo-stream | 334 | 28 | 467.33 | 38.78 | 2.932 | 37.204 | 84 | 4.5% |
| superjson | 25 | 81 | 93.34 | 303.95 | 42.117 | 12.503 | 7 | 6.1% |
| ungap-structured-clone | 25 | 81 | 92.25 | 304.82 | 43.684 | 12.324 | 7 | 6.4% |

**B05-typed-arrays — TypedArray / ArrayBuffer / DataView 混合**

![B05-typed-arrays-throughput](charts/B05-typed-arrays-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| msgpackr | 27,279 | 30,390 | 7696.24 | 8573.86 | 0.025 | 0.026 | 6820 | 4.7% |
| v8 | 26,018 | 34,920 | 7340.49 | 9851.83 | 0.029 | 0.021 | 6505 | 4.3% |
| structuredClone | 25,782 | - | - | - | 0.029 | - | 6446 | 3.7% |
| obj-codec | 20,871 | 28,118 | 5888.76 | 7933.33 | 0.037 | 0.028 | 5218 | 4.1% |
| devalue | 5,593 | 3,977 | 2097.17 | 1491.26 | 0.164 | 0.273 | 1399 | 2.8% |
| seroval | 3,759 | 519 | 1410.20 | 194.86 | 0.244 | 1.907 | 940 | 3.3% |
| turbo-stream | 1,102 | 120 | 414.43 | 45.08 | 0.933 | 9.291 | 276 | 1.4% |

**B06-edge-values — 边界值 undefined / NaN / ±Inf / -0**

![B06-edge-values-throughput](charts/B06-edge-values-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 5,471 | 2,689 | 530.69 | 260.85 | 0.186 | 0.360 | 1368 | 4.4% |
| obj-codec | 2,630 | 2,144 | 147.15 | 119.97 | 0.365 | 0.450 | 658 | 2.8% |
| structuredClone | 2,181 | - | - | - | 0.455 | - | 546 | 0.5% |
| devalue | 1,360 | 2,221 | 124.93 | 203.99 | 0.689 | 0.435 | 341 | 3.5% |
| seroval | 1,249 | 39,881 | 99.84 | 3187.67 | 0.769 | 0.024 | 313 | 3.7% |
| turbo-stream | 925 | 746 | 76.67 | 61.90 | 1.091 | 1.281 | 232 | 2.3% |
| superjson | 113 | 231 | 30.90 | 63.24 | 9.347 | 4.216 | 29 | 4.6% |

**B07-everything — 全类型混合（扩展版 A06）**

![B07-everything-throughput](charts/B07-everything-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 2,908 | 1,653 | 208.32 | 118.43 | 0.336 | 0.599 | 727 | 1.0% |
| structuredClone | 1,197 | - | - | - | 0.761 | - | 300 | 2.9% |
| obj-codec | 1,137 | 1,200 | 52.24 | 55.13 | 0.865 | 0.793 | 285 | 3.3% |
| seroval | 589 | 1,947 | 67.40 | 222.86 | 1.991 | 0.849 | 148 | 3.3% |
| devalue | 553 | 832 | 80.90 | 121.65 | 1.852 | 1.153 | 139 | 3.3% |
| turbo-stream | 447 | 490 | 45.62 | 49.93 | 2.316 | 1.990 | 112 | 3.1% |

</details>

### 载荷体积

![s1-payload-size](charts/s1-payload-size.svg)

<details>
<summary>全部库的载荷体积（12 个库）</summary>

| 数据集 | v8 | cbor-x | msgpack | msgpackr | superjson | devalue | seroval | turbo-stream | ungap-structured-clone | bson | ion-js | obj-codec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B01-bigint | 36KB | 30KB | - | 34KB | 126KB | 10KB | 52KB | 52KB | 9.9KB | - | - | 25KB |
| B02-date | 214KB | 196KB | 191KB | 97KB | 598KB | 509KB | 448KB | 393KB | 406KB | 236KB | 134KB | 129KB |
| B03-collections | 71KB | 67KB | - | 67KB | 93KB | 131KB | 93KB | 93KB | 177KB | - | - | 70KB |
| B04-binary | 1.0MB | 1.0MB | 1.0MB | 1.0MB | 3.6MB | 1.3MB | - | 1.3MB | 3.6MB | - | 1.0MB | 1.0MB |
| B05-typed-arrays | 276KB | - | - | 276KB | - | 366KB | 366KB | 367KB | - | - | - | 276KB |
| B06-edge-values | 95KB | - | - | - | 267KB | 90KB | 78KB | 81KB | - | - | - | 55KB |
| B07-everything | 70KB | - | - | - | - | 143KB | 112KB | 100KB | - | - | - | 45KB |

gzip (level 9) 后体积：

| 数据集 | v8 | cbor-x | msgpack | msgpackr | superjson | devalue | seroval | turbo-stream | ungap-structured-clone | bson | ion-js | obj-codec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B01-bigint | 3.3KB | 3.2KB | - | 3.2KB | 19KB | 2.8KB | 3.3KB | 3.3KB | 2.8KB | - | - | 3.2KB |
| B02-date | 35KB | 41KB | 47KB | 42KB | 71KB | 83KB | 49KB | 49KB | 80KB | 44KB | 43KB | 34KB |
| B03-collections | 27KB | 27KB | - | 27KB | 30KB | 52KB | 30KB | 30KB | 55KB | - | - | 27KB |
| B04-binary | 1.0MB | 1.0MB | 1.0MB | 1.0MB | 1.3MB | 1.0MB | - | 1.0MB | 1.3MB | - | 1.0MB | 1.0MB |
| B05-typed-arrays | 222KB | - | - | 222KB | - | 232KB | 233KB | 232KB | - | - | - | 222KB |
| B06-edge-values | 2.5KB | - | - | - | 20KB | 7.5KB | 2.8KB | 2.9KB | - | - | - | 2.4KB |
| B07-everything | 17KB | - | - | - | - | 34KB | 20KB | 19KB | - | - | - | 15KB |

</details>

### 内存（子进程，GC 后采样）

![s1-memory-encode-peak](charts/s1-memory-encode-peak.svg)

<details>
<summary>全部内存采样</summary>

| 数据集 | 库 | 编码峰值堆 | 解码峰值堆 | 结果常驻 | 进程 maxRSS |
| --- | --- | ---: | ---: | ---: | ---: |
| B01-bigint | v8 | 4.9KB | 104KB | 81KB | 122MB |
| B01-bigint | structuredClone | 111KB | 3.6KB | 83KB | 121MB |
| B01-bigint | superjson | 4.6MB | 4.5MB | 116KB | 126MB |
| B01-bigint | cbor-x | 2.0MB | 1.2MB | 91KB | 123MB |
| B01-bigint | msgpackr | 824KB | 995KB | 80KB | 122MB |
| B01-bigint | devalue | 788KB | 71KB | 16KB | 122MB |
| B01-bigint | seroval | 615KB | 241KB | 214KB | 122MB |
| B01-bigint | turbo-stream | 1.2MB | 1.6MB | 186KB | 127MB |
| B01-bigint | ungap-structured-clone | 270KB | 295KB | 27KB | 120MB |
| B01-bigint | obj-codec | 1.4MB | 1.9MB | 66KB | 122MB |
| B02-date | v8 | 4.9KB | 1.6MB | 1.1MB | 123MB |
| B02-date | structuredClone | 1.6MB | 3.6KB | 1.1MB | 123MB |
| B02-date | superjson | 12MB | 13MB | 1.6MB | 151MB |
| B02-date | cbor-x | 1.1MB | 1.8MB | 1.1MB | 124MB |
| B02-date | msgpackr | 2.9MB | 3.0MB | 1.1MB | 129MB |
| B02-date | msgpack | 4.7MB | 4.1MB | 1.1MB | 131MB |
| B02-date | devalue | 8.3MB | 3.8MB | 2.7MB | 137MB |
| B02-date | seroval | 5.4MB | 2.4MB | 2.4MB | 138MB |
| B02-date | turbo-stream | 8.0MB | 3.0MB | 1.5MB | 141MB |
| B02-date | ungap-structured-clone | 8.9MB | 7.9MB | 1.4MB | 135MB |
| B02-date | bson | 1.3MB | 5.1MB | 1.1MB | 134MB |
| B02-date | ion-js | 26MB | 41MB | 976KB | 255MB |
| B02-date | obj-codec | 3.4MB | 3.0MB | 974KB | 129MB |
| B03-collections | v8 | 83KB | 477KB | 300KB | 124MB |
| B03-collections | structuredClone | 585KB | 3.6KB | 299KB | 122MB |
| B03-collections | superjson | 6.9MB | 691KB | 285KB | 134MB |
| B03-collections | cbor-x | 1.3MB | 610KB | 312KB | 123MB |
| B03-collections | msgpackr | 966KB | 596KB | 316KB | 123MB |
| B03-collections | devalue | 4.7MB | 825KB | 553KB | 125MB |
| B03-collections | seroval | 2.8MB | 833KB | 508KB | 126MB |
| B03-collections | turbo-stream | 5.8MB | 3.6MB | 423KB | 137MB |
| B03-collections | ungap-structured-clone | 6.5MB | 4.3MB | 368KB | 129MB |
| B03-collections | obj-codec | 2.7MB | 1.7MB | 301KB | 124MB |
| B04-binary | v8 | 5.1KB | 4.5KB | -19304B | 135MB |
| B04-binary | structuredClone | 5.5KB | 3.6KB | -18616B | 134MB |
| B04-binary | superjson | 29MB | 16MB | 3.6MB | 206MB |
| B04-binary | cbor-x | 58KB | 4.6KB | 36KB | 135MB |
| B04-binary | msgpackr | 13KB | 43KB | 29KB | 137MB |
| B04-binary | msgpack | 8.9KB | 14KB | -9272B | 137MB |
| B04-binary | devalue | 1.4MB | 2.7MB | 1.3MB | 140MB |
| B04-binary | turbo-stream | 12MB | 44MB | 1.4MB | 213MB |
| B04-binary | ungap-structured-clone | 29MB | 16MB | 3.6MB | 205MB |
| B04-binary | ion-js | 65KB | 45KB | 28KB | 137MB |
| B04-binary | obj-codec | 31KB | 33KB | 4.4KB | 136MB |
| B05-typed-arrays | v8 | 15KB | 6.6KB | -10592B | 123MB |
| B05-typed-arrays | structuredClone | 14KB | 3.6KB | -10120B | 123MB |
| B05-typed-arrays | msgpackr | 17KB | 9.6KB | -3096B | 123MB |
| B05-typed-arrays | devalue | 750KB | 742KB | 351KB | 124MB |
| B05-typed-arrays | seroval | 1.1MB | 1.4MB | 1.1MB | 127MB |
| B05-typed-arrays | turbo-stream | 3.5MB | 12MB | 399KB | 143MB |
| B05-typed-arrays | obj-codec | 33KB | 29KB | 4.6KB | 122MB |
| B06-edge-values | v8 | 4.9KB | 304KB | 154KB | 124MB |
| B06-edge-values | structuredClone | 305KB | 3.6KB | 145KB | 122MB |
| B06-edge-values | superjson | 9.1MB | 7.5MB | 391KB | 134MB |
| B06-edge-values | devalue | 2.4MB | 1014KB | 237KB | 124MB |
| B06-edge-values | seroval | 1.5MB | 482KB | 468KB | 125MB |
| B06-edge-values | turbo-stream | 3.4MB | 1.1MB | 272KB | 137MB |
| B06-edge-values | obj-codec | 1.1MB | 778KB | 121KB | 124MB |
| B07-everything | v8 | 139KB | 521KB | 398KB | 122MB |
| B07-everything | structuredClone | 616KB | 3.6KB | 423KB | 123MB |
| B07-everything | devalue | 3.6MB | 1.4MB | 539KB | 130MB |
| B07-everything | seroval | 3.0MB | 1.1MB | 971KB | 130MB |
| B07-everything | turbo-stream | 4.2MB | 2.8MB | 620KB | 143MB |
| B07-everything | obj-codec | 2.0MB | 1.5MB | 355KB | 125MB |

</details>

### 失败与不保真

| 数据集 | 库 | 状态 | 说明 |
| --- | --- | --- | --- |
| B01-bigint | msgpack | fidelity-fail | [7]: bigint 2 != bigint 18446744073709551618 |
| B04-binary | seroval | error | Error: Seroval Error (step: 1) |
| B06-edge-values | cbor-x | fidelity-fail | $.rows[0].minusZero: -0 != 0 |

## 套件 S2

### 汇总（跨数据集几何均值）

![s2-summary](charts/s2-summary.svg)

<details>
<summary>汇总数值</summary>

| 库 | 编码 ops/s | 解码 ops/s | 参与数据集 | 失败 |
| --- | ---: | ---: | ---: | ---: |
| v8 | 3,954 | 2,466 | 4 | 0 |
| msgpackr | 3,349 | 5,766 | 4 | 0 |
| structuredClone | 2,056 | - | 4 | 0 |
| obj-codec | 1,509 | 2,591 | 4 | 0 |
| seroval | 1,202 | 15,056 | 4 | 0 |
| devalue | 1,132 | 2,800 | 4 | 0 |
| ungap-structured-clone | 1,084 | 1,246 | 4 | 0 |
| turbo-stream | 827 | 957 | 4 | 0 |
| superjson | 290 | 1,041 | 4 | 0 |
| flatted | 196 | 63 | 3 | 1 |
</details>

### 分数据集吞吐

<details>
<summary>分数据集明细（4 个数据集，各含图表与完整数值）</summary>

**C01-cycle-simple — 简单自引用（对象/数组/Map/Set 环）**

![C01-cycle-simple-throughput](charts/C01-cycle-simple-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| devalue | 660,889 | 828,465 | 71.38 | 89.47 | 0.001 | 0.001 | 165223 | 0.5% |
| msgpackr | 622,897 | 546,043 | 66.03 | 57.88 | 0.002 | 0.002 | 155725 | 0.5% |
| structuredClone | 546,553 | - | - | - | 0.002 | - | 136639 | 0.3% |
| v8 | 497,818 | 619,765 | 40.32 | 50.20 | 0.001 | 0.001 | 124479 | 16.6% |
| ungap-structured-clone | 451,015 | 446,435 | 81.63 | 80.80 | 0.002 | 0.002 | 112754 | 0.5% |
| seroval | 347,761 | 1,673,910 | 45.90 | 220.96 | 0.003 | 0.001 | 86941 | 1.2% |
| obj-codec | 201,292 | 381,418 | 17.51 | 33.18 | 0.005 | 0.002 | 50323 | 0.7% |
| turbo-stream | 161,638 | 242,590 | 14.39 | 21.59 | 0.006 | 0.004 | 40410 | 0.6% |
| superjson | 114,464 | 272,379 | 29.07 | 69.18 | 0.008 | 0.004 | 28616 | 0.6% |

**C02-dag-fanin — 高扇入 DAG（同一节点被 1e4 处引用）**

![C02-dag-fanin-throughput](charts/C02-dag-fanin-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 1,071 | 499 | 173.37 | 80.74 | 0.891 | 1.630 | 268 | 8.5% |
| msgpackr | 857 | 1,848 | 85.47 | 184.41 | 1.126 | 0.538 | 215 | 1.9% |
| structuredClone | 437 | - | - | - | 2.347 | - | 110 | 1.5% |
| obj-codec | 411 | 732 | 53.42 | 95.19 | 2.598 | 1.322 | 103 | 6.1% |
| seroval | 291 | 3,322 | 43.38 | 494.85 | 3.732 | 0.258 | 73 | 4.2% |
| flatted | 262 | 83 | 72.91 | 23.12 | 3.980 | 12.581 | 66 | 1.6% |
| ungap-structured-clone | 190 | 224 | 71.94 | 84.50 | 5.087 | 4.899 | 48 | 6.1% |
| turbo-stream | 179 | 241 | 35.54 | 47.93 | 5.603 | 4.082 | 45 | 4.0% |
| devalue | 165 | 558 | 49.21 | 166.34 | 6.739 | 1.730 | 42 | 8.2% |
| superjson | 47 | 149 | 49.67 | 156.13 | 22.001 | 6.670 | 12 | 8.1% |

**C03-graph-entities — ORM 风格实体图（2e3 父 × 5 子，双向引用）**

![C03-graph-entities-throughput](charts/C03-graph-entities-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 577 | 258 | 230.81 | 103.42 | 1.740 | 3.117 | 145 | 0.4% |
| msgpackr | 559 | 875 | 94.64 | 148.21 | 1.764 | 1.133 | 140 | 1.4% |
| obj-codec | 225 | 367 | 57.29 | 93.45 | 4.424 | 2.590 | 57 | 7.3% |
| structuredClone | 218 | - | - | - | 4.911 | - | 55 | 1.8% |
| flatted | 157 | 50 | 94.77 | 30.11 | 6.725 | 20.961 | 40 | 2.0% |
| seroval | 113 | 2,246 | 54.82 | 1093.18 | 9.562 | 0.379 | 29 | 4.2% |
| turbo-stream | 111 | 107 | 53.68 | 51.73 | 8.827 | 9.377 | 28 | 6.2% |
| devalue | 97 | 301 | 61.19 | 190.64 | 11.061 | 3.250 | 25 | 9.5% |
| ungap-structured-clone | 94 | 141 | 60.08 | 90.42 | 11.621 | 6.335 | 24 | 12.2% |
| superjson | 30 | 120 | 24.87 | 99.21 | 35.511 | 8.492 | 8 | 8.8% |

**C04-refs-mixed — 环 + 共享 + 深嵌套混合**

![C04-refs-mixed-throughput](charts/C04-refs-mixed-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v8 | 795 | 463 | 260.67 | 151.89 | 1.135 | 2.123 | 208 | 13.6% |
| msgpackr | 422 | 1,252 | 71.89 | 213.36 | 2.374 | 0.748 | 106 | 1.6% |
| structuredClone | 344 | - | - | - | 3.023 | - | 86 | 1.4% |
| obj-codec | 279 | 439 | 50.53 | 79.70 | 3.699 | 2.134 | 70 | 5.0% |
| seroval | 183 | 4,114 | 57.07 | 1281.95 | 6.353 | 0.221 | 46 | 6.9% |
| flatted | 183 | 61 | 86.40 | 28.65 | 5.691 | 17.289 | 46 | 2.0% |
| ungap-structured-clone | 171 | 171 | 73.51 | 73.36 | 5.924 | 5.713 | 43 | 5.6% |
| devalue | 156 | 442 | 64.11 | 181.94 | 6.852 | 2.213 | 39 | 7.7% |
| turbo-stream | 146 | 134 | 52.22 | 47.85 | 6.620 | 7.597 | 37 | 4.7% |
| superjson | 43 | 242 | 28.96 | 161.05 | 25.850 | 3.824 | 11 | 8.9% |

</details>

### 载荷体积

![s2-payload-size](charts/s2-payload-size.svg)

<details>
<summary>全部库的载荷体积（9 个库）</summary>

| 数据集 | v8 | msgpackr | superjson | devalue | seroval | turbo-stream | flatted | ungap-structured-clone | obj-codec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C01-cycle-simple | 81B | 106B | 254B | 108B | 132B | 89B | - | 181B | 87B |
| C02-dag-fanin | 158KB | 97KB | 1023KB | 291KB | 145KB | 194KB | 271KB | 369KB | 127KB |
| C03-graph-entities | 391KB | 165KB | 809KB | 619KB | 475KB | 472KB | 589KB | 625KB | 249KB |
| C04-refs-mixed | 320KB | 166KB | 651KB | 402KB | 304KB | 349KB | 461KB | 419KB | 177KB |

gzip (level 9) 后体积：

| 数据集 | v8 | msgpackr | superjson | devalue | seroval | turbo-stream | flatted | ungap-structured-clone | obj-codec |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C01-cycle-simple | 93B | 102B | 159B | 110B | 133B | 101B | - | 127B | 100B |
| C02-dag-fanin | 16KB | 22KB | 53KB | 71KB | 23KB | 26KB | 48KB | 71KB | 15KB |
| C03-graph-entities | 66KB | 78KB | 95KB | 160KB | 119KB | 78KB | 112KB | 158KB | 58KB |
| C04-refs-mixed | 36KB | 37KB | 52KB | 91KB | 37KB | 38KB | 77KB | 90KB | 31KB |

</details>

### 内存（子进程，GC 后采样）

![s2-memory-encode-peak](charts/s2-memory-encode-peak.svg)

<details>
<summary>全部内存采样</summary>

| 数据集 | 库 | 编码峰值堆 | 解码峰值堆 | 结果常驻 | 进程 maxRSS |
| --- | --- | ---: | ---: | ---: | ---: |
| C01-cycle-simple | v8 | 4.9KB | 4.9KB | -18232B | 121MB |
| C01-cycle-simple | structuredClone | 5.9KB | 3.6KB | -18112B | 122MB |
| C01-cycle-simple | superjson | 44KB | 17KB | 1.8KB | 120MB |
| C01-cycle-simple | msgpackr | 11KB | 14KB | -472B | 123MB |
| C01-cycle-simple | devalue | 13KB | 6.6KB | -17184B | 120MB |
| C01-cycle-simple | seroval | 26KB | 7.6KB | -3496B | 120MB |
| C01-cycle-simple | turbo-stream | 37KB | 27KB | -25584B | 125MB |
| C01-cycle-simple | ungap-structured-clone | 20KB | 241KB | 25KB | 121MB |
| C01-cycle-simple | obj-codec | 26KB | 24KB | -7552B | 121MB |
| C02-dag-fanin | v8 | 4.9KB | 1.4MB | 607KB | 123MB |
| C02-dag-fanin | structuredClone | 1.4MB | 3.6KB | 606KB | 124MB |
| C02-dag-fanin | superjson | 19MB | 6.9MB | 1.5MB | 160MB |
| C02-dag-fanin | msgpackr | 1.4MB | 2.4MB | 448KB | 124MB |
| C02-dag-fanin | devalue | 13MB | 3.9MB | 1.6MB | 140MB |
| C02-dag-fanin | seroval | 8.4MB | 1.7MB | 1.7MB | 144MB |
| C02-dag-fanin | turbo-stream | 3.4MB | 2.9MB | 856KB | 143MB |
| C02-dag-fanin | flatted | 3.0MB | 9.0MB | 2.1MB | 133MB |
| C02-dag-fanin | ungap-structured-clone | 15MB | 13MB | 977KB | 147MB |
| C02-dag-fanin | obj-codec | 7.3MB | 2.4MB | 619KB | 130MB |
| C03-graph-entities | v8 | 4.9KB | 2.2MB | 886KB | 123MB |
| C03-graph-entities | structuredClone | 2.2MB | 3.6KB | 886KB | 123MB |
| C03-graph-entities | superjson | 22MB | 10MB | 1.5MB | 175MB |
| C03-graph-entities | msgpackr | 1.6MB | 3.6MB | 821KB | 128MB |
| C03-graph-entities | devalue | 19MB | 5.8MB | 2.6MB | 148MB |
| C03-graph-entities | seroval | 17MB | 3.3MB | 3.0MB | 169MB |
| C03-graph-entities | turbo-stream | 8.8MB | 7.4MB | 1.6MB | 143MB |
| C03-graph-entities | flatted | 4.8MB | 13MB | 2.6MB | 143MB |
| C03-graph-entities | ungap-structured-clone | 21MB | 17MB | 1.6MB | 163MB |
| C03-graph-entities | obj-codec | 1.5MB | 4.2MB | 1.0MB | 132MB |
| C04-refs-mixed | v8 | 4.9KB | 1.7MB | 1.1MB | 130MB |
| C04-refs-mixed | structuredClone | 1.7MB | 3.6KB | 1007KB | 130MB |
| C04-refs-mixed | superjson | 11MB | 3.9MB | 1.4MB | 158MB |
| C04-refs-mixed | msgpackr | 1.3MB | 2.2MB | 1.0MB | 132MB |
| C04-refs-mixed | devalue | 12MB | 3.6MB | 2.0MB | 142MB |
| C04-refs-mixed | seroval | 9.8MB | 1.8MB | 1.8MB | 146MB |
| C04-refs-mixed | turbo-stream | 12MB | 6.4MB | 2.0MB | 146MB |
| C04-refs-mixed | flatted | 4.7MB | 11MB | 2.4MB | 140MB |
| C04-refs-mixed | ungap-structured-clone | 16MB | 14MB | 1.7MB | 157MB |
| C04-refs-mixed | obj-codec | 6.5MB | 4.3MB | 1.3MB | 135MB |

</details>

### 失败与不保真

| 数据集 | 库 | 状态 | 说明 |
| --- | --- | --- | --- |
| C01-cycle-simple | flatted | fidelity-fail | map cycle identity |

## 套件 S3

### 汇总（跨数据集几何均值）

![s3-summary](charts/s3-summary.svg)

<details>
<summary>汇总数值</summary>

| 库 | 编码 ops/s | 解码 ops/s | 参与数据集 | 失败 |
| --- | ---: | ---: | ---: | ---: |
| obj-codec | 1,623 | 2,037 | 4 | 0 |
| seroval | 1,192 | 11,190 | 2 | 0 |
</details>

### 分数据集吞吐

<details>
<summary>分数据集明细（4 个数据集，各含图表与完整数值）</summary>

**D01-symbols — Symbol 密集 2e3**

![D01-symbols-throughput](charts/D01-symbols-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| obj-codec | 3,841 | 2,978 | 89.69 | 69.54 | 0.253 | 0.351 | 961 | 1.7% |

**D02-unique-pointers — Unique Pointer（globalThis / 内建 Symbol / 单例）5e3 处引用**

![D02-unique-pointers-throughput](charts/D02-unique-pointers-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| obj-codec | 552 | 866 | 63.41 | 99.51 | 1.866 | 1.128 | 138 | 5.4% |

**D03-custom-class-primitive — 自定义类（primitive payload）5e3 实例**

![D03-custom-class-primitive-throughput](charts/D03-custom-class-primitive-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| obj-codec | 1,758 | 3,628 | 79.18 | 163.42 | 0.546 | 0.268 | 440 | 2.1% |
| seroval | 1,010 | 8,839 | 85.16 | 744.97 | 0.926 | 0.111 | 253 | 3.0% |

**D04-custom-class-container — 自定义类（container payload）3e3 节点**

![D04-custom-class-container-throughput](charts/D04-custom-class-container-throughput.svg)

| 库 | 编码 ops/s | 解码 ops/s | 编码 MB/s | 解码 MB/s | enc p75 (ms) | dec p75 (ms) | 样本 | enc RME |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| obj-codec | 1,863 | 1,840 | 105.46 | 104.19 | 0.520 | 0.522 | 466 | 2.4% |
| seroval | 1,407 | 14,166 | 153.19 | 1542.39 | 0.679 | 0.070 | 352 | 2.4% |

</details>

### 载荷体积

![s3-payload-size](charts/s3-payload-size.svg)

<details>
<summary>全部库的载荷体积（2 个库）</summary>

| 数据集 | seroval | obj-codec |
| --- | ---: | ---: |
| D01-symbols | - | 23KB |
| D02-unique-pointers | - | 112KB |
| D03-custom-class-primitive | 82KB | 44KB |
| D04-custom-class-container | 106KB | 55KB |

gzip (level 9) 后体积：

| 数据集 | seroval | obj-codec |
| --- | ---: | ---: |
| D01-symbols | - | 4.5KB |
| D02-unique-pointers | - | 9.6KB |
| D03-custom-class-primitive | 11KB | 8.8KB |
| D04-custom-class-container | 16KB | 18KB |

</details>

### 内存（子进程，GC 后采样）

![s3-memory-encode-peak](charts/s3-memory-encode-peak.svg)

<details>
<summary>全部内存采样</summary>

| 数据集 | 库 | 编码峰值堆 | 解码峰值堆 | 结果常驻 | 进程 maxRSS |
| --- | --- | ---: | ---: | ---: | ---: |
| D01-symbols | obj-codec | 552KB | 618KB | 111KB | 121MB |
| D02-unique-pointers | obj-codec | 3.4MB | 1.5MB | 301KB | 128MB |
| D03-custom-class-primitive | seroval | 3.8MB | 576KB | 539KB | 124MB |
| D03-custom-class-primitive | obj-codec | 681KB | 1.0MB | 226KB | 121MB |
| D04-custom-class-container | seroval | 3.0MB | 465KB | 452KB | 123MB |
| D04-custom-class-container | obj-codec | 951KB | 1.4MB | 236KB | 124MB |

</details>

## 套件 S5 · 伸缩

### 伸缩曲线 (S5)

单次操作耗时 (ms)，单发模式：每个 case 只测一次编码与一次解码。图为等距双对数坐标，越靠近左下越好；斜率是 log-log 最小二乘拟合，1 表示线性、2 表示平方。

**形状 ints**

![s5-ints-encode](charts/s5-ints-encode.svg)

<details>
<summary>形状 ints · 完整数值与斜率</summary>

| 库 | 指标 | 1,000 | 10,000 | 30,000 | 100,000 | 1,000,000 | 斜率 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| json | encode | 0.02 | 0.09 | 0.31 | 0.95 | 9.28 | 0.90 |
| json | decode | 0.03 | 0.09 | 0.26 | 0.94 | 8.31 | 0.82 |
| v8 | encode | 0.04 | 0.09 | 0.20 | 0.65 | 5.85 | 0.73 |
| v8 | decode | 0.06 | 0.16 | 0.47 | 1.25 | 12.02 | 0.78 |
| structuredClone | encode | 0.04 | 0.18 | 0.50 | 1.76 | 17.78 | 0.89 |
| structuredClone | decode | x | x | x | x | x | - |
| superjson | encode | 1.80 | 6.23 | 16.32 | 40.95 | 388.25 | 0.78 |
| superjson | decode | 0.19 | 0.13 | 0.37 | 0.80 | 7.65 | 0.56 |
| cbor-x | encode | 0.64 | 1.10 | 1.47 | 2.55 | 14.95 | 0.45 |
| cbor-x | decode | 0.46 | 0.89 | 1.33 | 2.67 | 14.39 | 0.50 |
| msgpackr | encode | 0.72 | 1.27 | 1.74 | 1.96 | 7.60 | 0.33 |
| msgpackr | decode | 0.45 | 0.90 | 1.38 | 2.03 | 7.12 | 0.39 |
| msgpack | encode | 0.48 | 0.99 | 1.62 | 2.93 | 15.14 | 0.50 |
| msgpack | decode | 0.61 | 1.08 | 1.48 | 2.53 | 8.09 | 0.37 |
| devalue | encode | 0.77 | 2.78 | 7.26 | 21.45 | 154.87 | 0.78 |
| devalue | decode | 0.47 | 1.53 | 2.09 | 4.76 | 23.02 | 0.56 |
| seroval | encode | 0.74 | 1.48 | 3.44 | 11.61 | 97.45 | 0.73 |
| seroval | decode | 0.14 | 0.55 | 1.30 | 4.43 | 38.65 | 0.83 |
| turbo-stream | encode | 22.51 | 24.93 | 27.67 | 40.54 | 175.37 | 0.29 |
| turbo-stream | decode | 1.47 | 2.61 | 4.93 | 10.79 | 84.48 | 0.59 |
| flatted | encode | 0.22 | 0.82 | 2.30 | 7.42 | 69.38 | 0.85 |
| flatted | decode | 0.58 | 3.85 | 11.79 | 37.40 | 437.28 | 0.96 |
| ungap-structured-clone | encode | 0.55 | 1.87 | 3.42 | 7.97 | 60.28 | 0.67 |
| ungap-structured-clone | decode | 0.46 | 1.52 | 3.15 | 7.51 | 45.36 | 0.67 |
| bson | encode | 0.81 | 1.56 | 3.02 | 7.45 | 75.53 | 0.66 |
| bson | decode | 0.77 | 1.68 | 2.36 | 4.32 | 19.46 | 0.46 |
| ion-js | encode | 4.42 | 29.11 | 84.03 | 271.59 | 2.8s | 0.94 |
| ion-js | decode | 2.87 | 10.73 | 25.84 | 74.44 | 814.01 | 0.82 |
| obj-codec | encode | 0.90 | 1.61 | 2.33 | 4.37 | 14.10 | 0.40 |
| obj-codec | decode | 0.95 | 1.76 | 3.10 | 4.95 | 27.08 | 0.48 |

</details>

**形状 records**

![s5-records-encode](charts/s5-records-encode.svg)

<details>
<summary>形状 records · 完整数值与斜率</summary>

| 库 | 指标 | 1,000 | 10,000 | 30,000 | 100,000 | 斜率 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| json | encode | 0.10 | 1.46 | 4.12 | 12.12 | 1.06 |
| json | decode | 0.29 | 2.34 | 5.92 | 18.56 | 0.90 |
| v8 | encode | 0.17 | 1.26 | 4.69 | 14.46 | 0.97 |
| v8 | decode | 0.33 | 2.53 | 8.45 | 34.44 | 1.00 |
| structuredClone | encode | 0.41 | 3.95 | 13.07 | 49.01 | 1.04 |
| structuredClone | decode | x | x | x | x | - |
| superjson | encode | 4.52 | 29.77 | 75.89 | 238.66 | 0.86 |
| superjson | decode | 0.31 | 2.44 | 5.63 | 16.86 | 0.86 |
| cbor-x | encode | 1.61 | 5.22 | 18.59 | 42.08 | 0.72 |
| cbor-x | decode | 1.19 | 3.80 | 9.35 | 34.77 | 0.71 |
| msgpackr | encode | 1.60 | 4.71 | 9.78 | 29.05 | 0.61 |
| msgpackr | decode | 1.00 | 1.96 | 3.96 | 10.70 | 0.50 |
| msgpack | encode | 1.90 | 8.32 | 22.45 | 60.43 | 0.75 |
| msgpack | decode | 2.38 | 6.60 | 14.99 | 38.58 | 0.60 |
| devalue | encode | 2.37 | 16.40 | 44.92 | 160.96 | 0.91 |
| devalue | decode | 1.10 | 5.33 | 12.43 | 37.12 | 0.76 |
| seroval | encode | 2.65 | 17.74 | 35.45 | 143.41 | 0.84 |
| seroval | decode | 0.90 | 10.41 | 30.66 | 106.31 | 1.04 |
| turbo-stream | encode | 24.01 | 36.21 | 62.23 | 131.53 | 0.36 |
| turbo-stream | decode | 2.69 | 11.12 | 29.66 | 100.71 | 0.78 |
| flatted | encode | 0.99 | 9.21 | 26.99 | 95.22 | 0.99 |
| flatted | decode | 3.01 | 32.32 | 87.60 | 279.71 | 0.98 |
| ungap-structured-clone | encode | 2.07 | 16.07 | 50.26 | 138.72 | 0.92 |
| ungap-structured-clone | decode | 1.78 | 13.57 | 27.61 | 99.98 | 0.86 |
| bson | encode | 2.09 | 8.01 | 21.40 | 69.60 | 0.75 |
| bson | decode | 2.29 | 8.83 | 17.77 | 49.76 | 0.66 |
| ion-js | encode | 32.36 | 268.37 | 877.32 | 4.0s | 1.03 |
| ion-js | decode | 12.09 | 72.04 | 186.64 | 621.06 | 0.85 |
| obj-codec | encode | 3.19 | 11.97 | 30.45 | 92.24 | 0.72 |
| obj-codec | decode | 2.83 | 8.94 | 17.27 | 45.31 | 0.59 |

</details>

**形状 objects**

![s5-objects-encode](charts/s5-objects-encode.svg)

<details>
<summary>形状 objects · 完整数值与斜率</summary>

| 库 | 指标 | 1,000 | 10,000 | 30,000 | 100,000 | 斜率 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| json | encode | 0.08 | 0.65 | 2.35 | 7.75 | 1.00 |
| json | decode | 0.12 | 0.93 | 2.91 | 11.32 | 0.98 |
| v8 | encode | 0.11 | 0.85 | 3.08 | 8.80 | 0.96 |
| v8 | decode | 0.27 | 2.75 | 6.64 | 26.54 | 0.98 |
| structuredClone | encode | 0.32 | 2.79 | 9.30 | 36.96 | 1.02 |
| structuredClone | decode | x | x | x | x | - |
| superjson | encode | 3.24 | 22.56 | 58.57 | 192.45 | 0.88 |
| superjson | decode | 0.17 | 0.99 | 2.91 | 9.40 | 0.87 |
| cbor-x | encode | 1.69 | 2.77 | 5.16 | 15.64 | 0.46 |
| cbor-x | decode | 0.98 | 2.25 | 5.40 | 17.13 | 0.61 |
| msgpackr | encode | 1.24 | 2.97 | 5.05 | 13.10 | 0.49 |
| msgpackr | decode | 0.84 | 1.43 | 2.51 | 6.51 | 0.43 |
| msgpack | encode | 1.45 | 3.59 | 7.74 | 18.68 | 0.55 |
| msgpack | decode | 1.85 | 3.54 | 6.03 | 14.50 | 0.43 |
| devalue | encode | 2.11 | 12.58 | 32.92 | 121.03 | 0.87 |
| devalue | decode | 0.97 | 3.89 | 10.68 | 31.29 | 0.75 |
| seroval | encode | 3.65 | 11.60 | 30.31 | 81.37 | 0.67 |
| seroval | decode | 0.56 | 6.12 | 19.23 | 58.16 | 1.02 |
| turbo-stream | encode | 23.95 | 32.31 | 48.61 | 99.37 | 0.29 |
| turbo-stream | decode | 2.08 | 7.03 | 17.39 | 61.68 | 0.72 |
| flatted | encode | 0.68 | 4.56 | 13.24 | 48.27 | 0.92 |
| flatted | decode | 1.76 | 15.93 | 55.84 | 179.70 | 1.01 |
| ungap-structured-clone | encode | 1.74 | 12.19 | 39.41 | 113.93 | 0.91 |
| ungap-structured-clone | decode | 1.27 | 8.80 | 26.82 | 97.42 | 0.94 |
| bson | encode | 1.69 | 5.12 | 12.45 | 35.87 | 0.66 |
| bson | decode | 1.50 | 3.43 | 8.11 | 17.79 | 0.54 |
| ion-js | encode | 20.29 | 162.13 | 507.36 | 1.9s | 0.98 |
| ion-js | decode | 7.92 | 50.89 | 129.86 | 428.51 | 0.86 |
| obj-codec | encode | 2.68 | 7.64 | 20.12 | 58.50 | 0.66 |
| obj-codec | decode | 2.13 | 7.01 | 11.99 | 23.11 | 0.52 |

</details>

## 套件 S4 · 分块传输

载荷先整体编码一次，再按固定大小切块交给解码器。`incremental` 逐块喂给解码器，`buffered` 先拼接再解码（对照组）。图为解码耗时，越短越好；展开可见各档 chunk 的中位数与采样峰值堆。

**A03-short-strings** · 载荷 86KB · 整块 chunk 数 1

![s4-A03-short-strings-chunks](charts/s4-A03-short-strings-chunks.svg)

<details>
<summary>A03-short-strings · 各 chunk 大小的耗时与峰值堆</summary>

| 实现 | 模式 | 1KB | 16KB | 256KB | full |
| --- | --- | ---: | ---: | ---: | ---: |
| obj-codec-node | incremental | 2.32ms (1.4MB) | 1.95ms (1.3MB) | 2.55ms (1.3MB) | 1.93ms (1.3MB) |
| obj-codec-web | incremental | 5.44ms (1.9MB) | 5.07ms (1.7MB) | 3.48ms (1.6MB) | 4.02ms (1.6MB) |
| turbo-stream | incremental | 3.93ms (2.8MB) | 3.96ms (2.8MB) | 6.94ms (2.7MB) | 5.87ms (2.7MB) |
| cbor-x-buffered | buffered | 1.47ms (743KB) | 1.49ms (729KB) | 1.64ms (740KB) | 1.53ms (740KB) |
| msgpackr-buffered | buffered | 0.80ms (520KB) | 0.80ms (505KB) | 0.72ms (508KB) | 0.76ms (502KB) |
| json-buffered | buffered | 0.40ms (525KB) | 0.41ms (524KB) | 0.37ms (369KB) | 0.37ms (370KB) |

</details>

**A04-long-text** · 载荷 950KB · 整块 chunk 数 1

![s4-A04-long-text-chunks](charts/s4-A04-long-text-chunks.svg)

<details>
<summary>A04-long-text · 各 chunk 大小的耗时与峰值堆</summary>

| 实现 | 模式 | 1KB | 16KB | 256KB | full |
| --- | --- | ---: | ---: | ---: | ---: |
| obj-codec-node | incremental | 2.82ms (1.6MB) | 1.21ms (1.2MB) | 0.53ms (1.1MB) | 0.69ms (1.1MB) |
| obj-codec-web | incremental | 4.60ms (4.0MB) | 0.90ms (1.6MB) | 0.66ms (1.4MB) | 0.53ms (1.4MB) |
| turbo-stream | incremental | 19.62ms (30MB) | 19.29ms (30MB) | 24.67ms (30MB) | 20.86ms (30MB) |
| cbor-x-buffered | buffered | 0.69ms (1.1MB) | 0.66ms (1.1MB) | 0.60ms (1.0MB) | 0.63ms (1.0MB) |
| msgpackr-buffered | buffered | 0.70ms (1.1MB) | 0.65ms (1.1MB) | 0.63ms (1.1MB) | 0.63ms (1.1MB) |
| json-buffered | buffered | 0.65ms (2.0MB) | 0.67ms (2.0MB) | 0.67ms (2.0MB) | 0.44ms (1.0MB) |

</details>

**A09-mixed-payload** · 载荷 276KB · 整块 chunk 数 1

![s4-A09-mixed-payload-chunks](charts/s4-A09-mixed-payload-chunks.svg)

<details>
<summary>A09-mixed-payload · 各 chunk 大小的耗时与峰值堆</summary>

| 实现 | 模式 | 1KB | 16KB | 256KB | full |
| --- | --- | ---: | ---: | ---: | ---: |
| obj-codec-node | incremental | 4.80ms (5.0MB) | 4.31ms (4.9MB) | 4.53ms (4.8MB) | 5.08ms (4.8MB) |
| obj-codec-web | incremental | 12.34ms (6.0MB) | 4.37ms (5.2MB) | 9.35ms (5.1MB) | 5.85ms (5.1MB) |
| turbo-stream | incremental | 14.85ms (13MB) | 14.90ms (13MB) | 14.33ms (13MB) | 13.58ms (13MB) |
| cbor-x-buffered | buffered | 2.75ms (2.4MB) | 2.80ms (2.3MB) | 2.73ms (2.3MB) | 2.86ms (2.3MB) |
| msgpackr-buffered | buffered | 2.02ms (1.4MB) | 1.96ms (1.4MB) | 1.91ms (1.4MB) | 1.98ms (1.4MB) |
| json-buffered | buffered | 1.75ms (1.4MB) | 1.73ms (1.4MB) | 1.73ms (1.4MB) | 1.61ms (848KB) |

</details>

**B04-binary** · 载荷 1.0MB · 整块 chunk 数 1

![s4-B04-binary-chunks](charts/s4-B04-binary-chunks.svg)

<details>
<summary>B04-binary · 各 chunk 大小的耗时与峰值堆</summary>

| 实现 | 模式 | 1KB | 16KB | 256KB | full |
| --- | --- | ---: | ---: | ---: | ---: |
| obj-codec-node | incremental | 3.65ms (951KB) | 0.63ms (256KB) | 0.53ms (179KB) | 0.50ms (174KB) |
| obj-codec-web | incremental | 4.66ms (3.5MB) | 0.83ms (742KB) | 0.68ms (528KB) | 0.57ms (498KB) |
| turbo-stream | incremental | 60.87ms (44MB) | 60.57ms (44MB) | 53.53ms (44MB) | 61.46ms (44MB) |
| cbor-x-buffered | buffered | 0.73ms (214KB) | 0.38ms (130KB) | 0.52ms (125KB) | 0.35ms (125KB) |
| msgpackr-buffered | buffered | 0.76ms (217KB) | 0.72ms (133KB) | 0.83ms (129KB) | 0.74ms (129KB) |

</details>

**B07-everything** · 载荷 45KB · 整块 chunk 数 1

![s4-B07-everything-chunks](charts/s4-B07-everything-chunks.svg)

<details>
<summary>B07-everything · 各 chunk 大小的耗时与峰值堆</summary>

| 实现 | 模式 | 1KB | 16KB | 256KB | full |
| --- | --- | ---: | ---: | ---: | ---: |
| obj-codec-node | incremental | 2.64ms (1.8MB) | 2.33ms (1.7MB) | 2.02ms (1.9MB) | 1.94ms (1.7MB) |
| obj-codec-web | incremental | 4.56ms (2.2MB) | 2.43ms (2.0MB) | 3.51ms (2.0MB) | 3.55ms (2.0MB) |
| turbo-stream | incremental | 4.64ms (2.9MB) | 5.21ms (2.9MB) | 6.11ms (2.8MB) | 6.07ms (2.8MB) |

</details>

## 库自身体积

口径：esbuild (bundle, minify, platform=node, esm, node:* external)；压缩为 gzip level 9, brotli quality 11。平台内建（JSON / v8 / structuredClone）不参与。

![library-gzip-size](charts/library-gzip-size.svg)

<details>
<summary>全部体积与冷启动数据</summary>

| 库 | min | min+gzip | min+brotli | 运行时依赖 | native addon | 冷启动 import |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| flatted | 1.1KB | 636B | 593B | 0 | - | 3.4ms |
| ungap-structured-clone | 3.0KB | 1.4KB | 1.2KB | 0 | - | 3.9ms |
| superjson | 11KB | 4.0KB | 3.7KB | 0 | - | 6.0ms |
| turbo-stream | 14KB | 4.8KB | 4.3KB | 0 | - | 3.7ms |
| devalue | 19KB | 6.7KB | 6.1KB | 0 | - | 5.6ms |
| obj-codec | 21KB | 6.7KB | 6.1KB | - | - | 4.3ms |
| msgpack | 27KB | 7.2KB | 6.5KB | 0 | - | 5.1ms |
| cbor-x | 39KB | 15KB | 13KB | 0 | cbor-extract | 9.2ms |
| seroval | 51KB | 16KB | 14KB | 0 | - | 4.8ms |
| msgpackr | 44KB | 16KB | 15KB | 0 | - | 12.6ms |
| bson | 75KB | 22KB | 20KB | 0 | - | 6.9ms |
| ion-js | 129KB | 33KB | 28KB | 0 | - | 15.5ms |

</details>

## 库配置

| 库 | 版本 | 线格式 | 配置 |
| --- | --- | --- | --- |
| json | v24.16.0 | text | `{"api":"JSON.stringify/parse"}` |
| v8 | v24.16.0 | binary | `{"api":"v8.serialize/deserialize","nodeOnly":true}` |
| structuredClone | v24.16.0 | memory | `{"api":"structuredClone","inMemoryOnly":true}` |
| superjson | 2.2.6 | text | `{}` |
| cbor-x | 1.6.8 | binary | `{"useRecords":"default (true)"}` |
| msgpackr | 2.1.2 | binary | `{"structuredClone":true,"nativeAddon":true}` |
| msgpack | 3.1.3 | binary | `{"useBigInt64":true,"spec":"MessagePack"}` |
| devalue | 6.0.3 | js-expression | `{}` |
| seroval | 1.7.2 | js-expression | `{"note":"serialize() refuses typed arrays above ~1e6 bytes (DEFAULT_MAX_BASE64_LENGTH); the encode side is not configurable"}` |
| turbo-stream | 3.2.1 | text | `{"transport":"ReadableStream of string chunks","symbolSupport":false}` |
| flatted | 3.4.4 | text | `{}` |
| ungap-structured-clone | 1.4.0 | text | `{"entry":"@ungap/structured-clone/json","note":"the base entry returns a JS structure, not a wire format; the /json entry is the transport form, and it maps NaN/Infinity to null"}` |
| bson | 7.3.3 | binary | `{"api":"bson.serialize({v})","spec":"BSON"}` |
| ion-js | 5.2.1 | binary | `{"spec":"Ion binary"}` |
| obj-codec | 2.0.0 | binary | `{"api":"Codec.encodeSync/decodeSync","build":"dist/index.esm.js"}` |
