import { InternalCodec } from '../../types';

export const flexUintCodec = {
	encode(data) {
		const bufferLength = Math.ceil(data.toString(2).length / 7);
		const buffer = new Uint8Array(bufferLength);
		for (let i = 0; i < bufferLength; i++) {
			buffer[bufferLength - i - 1] = (data >> (i * 7)) | 0b1000_0000;
		}
		buffer[bufferLength - 1] &= 0b0111_1111;
		return buffer;
	},
	/**
	 * 获取弹性无符号整型完整缓冲区
	 * @description
	 * 若输入缓冲区不完整，返回 `null`
	 */
	getBuffer(buffer: Uint8Array): Uint8Array | null {
		let complete = false;
		let i = 0;
		while (i < buffer.length) {
			i++;
			if (buffer[i - 1] & 0b1000_0000) continue;
			complete = true;
			break;
		}
		return complete ? buffer.slice(0, i) : null;
	},
	decode(encoded) {
		let data = 0;
		for (let i = 0; i < encoded.length; i++) {
			data |= encoded[i] & 0b0111_1111;
			if (i < encoded.length - 1) {
				data <<= 7;
			}
		}
		return data;
	},
} as const satisfies InternalCodec<number> & {
	getBuffer(buffer: Uint8Array): Uint8Array | null;
};
