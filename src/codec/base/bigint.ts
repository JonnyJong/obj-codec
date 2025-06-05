import { InternalCodec } from '../../types';

export const bigintCodec = {
	encode(data) {
		const byteLength = Math.ceil(
			(data < 0n ? data : -data).toString(16).length / 2,
		);
		const buffer = new Uint8Array(byteLength);

		for (let i = 0; i < byteLength; i++) {
			buffer[i] = Number((data >> BigInt(i * 8)) & 0xffn);
		}

		return buffer;
	},
	decode(encoded) {
		let result = 0n;

		for (let i = 0; i < encoded.byteLength; i++) {
			result |= BigInt(encoded[i]) << BigInt(i * 8);
		}

		if (encoded[encoded.byteLength - 1] & 0x80) {
			const mask = (1n << BigInt(encoded.byteLength * 8)) - 1n;
			result |= ~mask;
		}

		return result;
	},
} as const satisfies InternalCodec<bigint>;
