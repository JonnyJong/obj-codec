import { bigintCodec } from 'codec/base/bigint';
import { binaryCodec } from 'codec/base/binary';
import { falseCodec, trueCodec } from 'codec/base/boolean';
import { nullCodec } from 'codec/base/null';
import { numberCodec } from 'codec/base/number';
import { stringCodec } from 'codec/base/string';
import { undefinedCodec } from 'codec/base/undefined';
import { arrayCodec } from 'codec/internal/array';
import { dateCodec } from 'codec/internal/date';
import { mapCodec } from 'codec/internal/map';
import { objectCodec } from 'codec/internal/object';
import { regexpCodec } from 'codec/internal/regexp';
import { setCodec } from 'codec/internal/set';
import { symbolCodec } from 'codec/internal/symbol';
import { InternalCodec, InternalTypeItem } from 'types';

export const INTERNAL_CODEC: InternalCodec = [
	binaryCodec,
	numberCodec,
	bigintCodec,
	stringCodec,
	falseCodec,
	trueCodec,
	nullCodec,
	undefinedCodec,
	objectCodec,
	arrayCodec,
	setCodec,
	mapCodec,
	dateCodec,
	regexpCodec,
	symbolCodec,
];

export const INTERNAL_TYPE_ID = {
	pointer: 0,
	binary: 1,
	number: 2,
	bigint: 3,
	string: 4,
	false: 5,
	true: 6,
	null: 7,
	undefined: 8,
	object: 9,
	array: 10,
	set: 11,
	map: 12,
	date: 13,
	regexp: 14,
	symbol: 15,
	uniquePointer: 16,
};

export const CUSTOM_TYPE_ID_BEGIN = 17;

export const INTERNAL_TYPES: InternalTypeItem[] = [
	{
		type: RegExp,
		typeId: INTERNAL_TYPE_ID.regexp,
		codec: regexpCodec,
	},
	{
		type: Date,
		typeId: INTERNAL_TYPE_ID.date,
		codec: dateCodec,
	},
	{
		type: Map,
		typeId: INTERNAL_TYPE_ID.map,
		codec: mapCodec,
	},
	{
		type: Set,
		typeId: INTERNAL_TYPE_ID.set,
		codec: setCodec,
	},
];

export const VERSION = 0x00;
