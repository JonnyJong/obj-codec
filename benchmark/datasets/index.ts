import { s0 } from './s0-json-safe';
import { s1 } from './s1-extended';
import { s2 } from './s2-references';
import { s3 } from './s3-proprietary';
import { s5 } from './s5-scaling';
import type { Dataset } from './types';

/** Payload suites. S4 (streaming) and S5 (scaling) live in the runner, not here. */
export const datasets: Dataset[] = [...s0, ...s1, ...s2, ...s3, ...s5];

export const datasetById = new Map(datasets.map((d) => [d.id, d]));

export type { Dataset } from './types';
