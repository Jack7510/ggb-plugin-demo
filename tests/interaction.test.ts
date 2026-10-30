/**
 * @fileoverview 拖动证据的纯判定回归；合成事实只用于注入未命中、歧义、
 * 其他点移动等故障，真实鼠标与重载证据由 integration.test.ts 覆盖。
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  DRAG_HIT_RADIUS_PX,
  evaluateDrag,
  toPixels,
  type DragEvidence,
  type ViewProperties,
} from '../src/interaction.js';
import {parseRequest} from '../src/request.js';
import {verifyRequest, type Fact, type Facts} from '../src/verify.js';

const request = parseRequest(
  JSON.parse(
    await readFile(
      new URL('../../examples/triangle.json', import.meta.url),
      'utf8',
    ),
  ),
);
const sample = request.interactions[0]!;
const view: ViewProperties = {
  left: 397,
  top: 51,
  width: 610,
  height: 648,
  xMin: -2,
  yMin: -2,
  invXscale: 0.01639344262295082,
  invYscale: 0.012345679012345678,
};
function fact(overrides: Partial<Fact> & {label: string; type: string}): Fact {
  return {
    exists: true,
    defined: true,
    independent: false,
    parents: [],
    coordinates: null,
    color: '#000000',
    labelVisible: false,
    labelStyle: 0,
    numericValue: null,
    command: '',
    algorithmXML: '',
    value: '',
    ...overrides,
  };
}
function point(
  label: string,
  x: number,
  y: number,
  parents: string[] = [],
): Fact {
  return fact({
    label,
    type: 'point',
    independent: parents.length === 0,
    parents,
    coordinates: [x, y],
    color: label === 'M' ? '#FF0000' : '#4D4DFF',
    labelVisible: true,
    value: `${label}=(${x},${y})`,
  });
}
function facts(
  a: [number, number],
  m: [number, number],
  options: {
    staticM?: boolean;
    otherB?: number;
    midpointTrue?: boolean;
    extraPoint?: [number, number];
  } = {},
): Facts {
  const staticM = options.staticM ?? false;
  return {
    engineVersion: 'test',
    scripts: [],
    objects: [
      point('A', ...a),
      point('B', options.otherB ?? 6, 0),
      point('C', 2, 4),
      ...(options.extraPoint ? [point('D', ...options.extraPoint)] : []),
      fact({
        label: 'tri',
        type: 'triangle',
        parents: ['A', 'B', 'C'],
      }),
      fact({
        label: 'M',
        type: 'point',
        independent: staticM,
        parents: staticM ? [] : ['A', 'B'],
        coordinates: m,
        color: '#FF0000',
        labelVisible: true,
      }),
      fact({
        label: 'CM',
        type: 'segment',
        parents: ['C', 'M'],
        color: '#FF0000',
        labelVisible: true,
      }),
      fact({
        label: 'ggbCheck6',
        type: 'boolean',
        numericValue: options.midpointTrue === false ? 0 : 1,
        value: options.midpointTrue === false ? 'false' : 'true',
      }),
      fact({
        label: 'ggbCheck7',
        type: 'boolean',
        numericValue: 1,
        value: 'true',
      }),
    ],
  };
}
function evidence(
  before: Facts,
  options: Partial<DragEvidence> = {},
): DragEvidence {
  const a = before.objects.find(object => object.label === 'A')!;
  const start = toPixels(a.coordinates!, view);
  const target = toPixels(sample.to, view);
  return {
    source: {
      file: 'construction.ggb',
      sha256: 'a'.repeat(64),
      freshContextEmptyCount: 0,
      reloadedContentEqual: true,
    },
    pointer: {
      start,
      target,
      steps: 24,
      down: true,
      up: true,
      hitRadiusPx: DRAG_HIT_RADIUS_PX,
      startCandidates: [],
      targetCandidates: [],
    },
    viewBefore: view,
    viewAfter: view,
    visible: true,
    screenshots: {
      before: 'interaction-moveA-before.png',
      after: 'interaction-moveA-after.png',
    },
    ...options,
  };
}
function evaluate(before: Facts, after: Facts, dragEvidence: DragEvidence) {
  return evaluateDrag(request, sample, before, after, dragEvidence);
}
await test('correct drag passes with native midpoint and median dependency facts', () => {
  const before = facts([0, 0], [3, 0]);
  const after = facts([-1, 1], [2.5, 0.5]);
  const report = evaluate(before, after, evidence(before));
  assert.equal(report.status, 'passed', JSON.stringify(report.reasons));
  assert.deepEqual(report.after?.coordinates, [-1, 1]);
  assert.deepEqual(report.displacement.world, [-1, 1]);
  assert.ok(report.targetError.pixels.every(value => Math.abs(value) < 1e-9));
  assert.deepEqual(
    report.checks.map(check => check.id),
    ['median', 'midpointRelation'],
  );
  assert.equal(report.checks[1]?.actual?.label, 'ggbCheck6');
  assert.equal(
    report.invariants.find(item => item.id === 'midpoint')?.status,
    'passed',
  );
  const moved = report.invariants.find(item => item.id === 'midpoint')?.actual;
  assert.deepEqual(moved?.parents, ['A', 'B']);
  assert.equal(moved?.independent, false);
});
await test('numeric coincidence at the initial position cannot pass dependency verification', () => {
  const result = verifyRequest(request, facts([0, 0], [3, 0], {staticM: true}));
  const midpoint = result.checks.find(check => check.id === 'midpoint');
  assert.equal(midpoint?.status, 'failed');
  assert.deepEqual(midpoint?.actual?.coordinates, [3, 0]);
  assert.equal(midpoint?.actual?.independent, true);
  assert.deepEqual(midpoint?.actual?.parents, []);
  assert.equal(
    result.checks.find(check => check.id === 'midpointRelation')?.status,
    'passed',
  );
});
await test('a pointer that stops short of the target is rejected even when relations still hold', () => {
  const before = facts([0, 0], [3, 0]);
  const after = facts([-0.9, 0.9], [2.55, 0.45]);
  const report = evaluate(before, after, evidence(before));
  assert.equal(report.status, 'failed');
  assert.ok(
    report.reasons.includes(
      'The pointer did not reach the declared target position',
    ),
  );
});
await test('an ambiguous mouse-down near another native point is rejected', () => {
  const before = facts([0, 0], [3, 0], {extraPoint: [0.1, 0]});
  const report = evaluate(
    before,
    facts([-1, 1], [2.5, 0.5], {extraPoint: [0.1, 0]}),
    evidence(before),
  );
  assert.equal(report.status, 'failed');
  assert.ok(report.reasons.some(reason => reason.includes('ambiguous')));
});
await test('a drag that moves another independent point is rejected', () => {
  const before = facts([0, 0], [3, 0]);
  const report = evaluate(
    before,
    facts([-1, 1], [2.5, 0.5], {otherB: 6.2}),
    evidence(before),
  );
  assert.equal(report.status, 'failed');
  assert.ok(report.reasons.includes('Another independent point moved: B'));
});
await test('view drift, missing release and dependency loss fail the sample', () => {
  const before = facts([0, 0], [3, 0]);
  const panned = evidence(before, {
    viewAfter: {...view, xMin: view.xMin + 0.1},
  });
  assert.equal(
    evaluate(before, facts([-1, 1], [2.5, 0.5]), panned).status,
    'failed',
  );
  const noRelease = evidence(before);
  noRelease.pointer.up = false;
  assert.equal(
    evaluate(before, facts([-1, 1], [2.5, 0.5]), noRelease).status,
    'failed',
  );
  const lostDependency = facts([-1, 1], [3, 0], {
    staticM: true,
    midpointTrue: false,
  });
  const report = evaluate(before, lostDependency, evidence(before));
  assert.equal(report.status, 'failed');
  assert.ok(
    report.reasons.some(reason => reason.includes('Failed after-drag checks')),
  );
});
