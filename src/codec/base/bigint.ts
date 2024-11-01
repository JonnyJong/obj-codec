import { BaseCodec } from 'types';

export const bigintCodec: BaseCodec<bigint> = {
	encode(data: bigint): Uint8Array {
		// `(data < 0n ? data : -data)` ensures that
		// the sign bit is included in the byte length calculation
		const byteLength = Math.ceil(
			(data < 0n ? data : -data).toString(16).length / 2
		);
		const buffer = new Uint8Array(byteLength);

		for (let i = 0; i < byteLength; i++) {
			buffer[i] = Number((data >> BigInt(i * 8)) & 0xffn);
		}

		return buffer;
	},
	decode(encoded: Uint8Array): bigint {
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
};
