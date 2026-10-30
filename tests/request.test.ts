/**
 * @fileoverview 验证模型输入的结构、引用、容量和副作用限制；合成事实仅用于纯判定测试。
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {parseRequest, type Request} from '../src/request.js';
import {verifyRequest} from '../src/verify.js';
const sample = JSON.parse(
  await readFile(
    new URL('../../examples/triangle-static.json', import.meta.url),
    'utf8',
  ),
) as Request;
await test('request schema rejects unknown fields, uncovered conditions, duplicates and bad references', () => {
  const variants = [
    {...sample, script: 'alert(1)'},
    {...sample, schemaVersion: 1},
    {...sample, styles: null},
    {
      ...sample,
      requirements: [
        ...sample.requirements,
        {id: 'drag', description: 'Must drag'},
      ],
    },
    {...sample, program: [...sample.program, sample.program[0]]},
    {
      ...sample,
      checks: sample.checks.map(c => ({...c, requirement: 'unknown'})),
    },
  ];
  for (const data of variants) {
    assert.throws(() => parseRequest(data));
  }
});
await test('native expressions reject scripting, URL strings, assignments and forward references', () => {
  for (const expression of [
    'Execute({1})',
    'SetValue(A,3)',
    'OpenURL(A)',
    '"https://example.com"',
    'A=3',
    'A;Delete(A)',
    'Midpoint(A,Z)',
    'ggbCheck0',
  ]) {
    assert.throws(() =>
      parseRequest({
        ...sample,
        program: sample.program.map(s =>
          s.label === 'M' ? {...s, expression} : s,
        ),
      }),
    );
  }
});
await test('static midpoint is structurally valid but must fail dependency verification', () => {
  const request = parseRequest({
    ...sample,
    program: sample.program.map(s =>
      s.label === 'M' ? {...s, expression: '(3,0)'} : s,
    ),
  });
  // 这些是纯核验单元测试的合成输入，不能用作真实引擎或交付证据。
  const result = verifyRequest(request, {
    engineVersion: 'test',
    scripts: [],
    objects: [
      {
        label: 'M',
        exists: true,
        defined: true,
        type: 'point',
        independent: true,
        parents: [],
        coordinates: [3, 0],
        color: '#FF0000',
        labelVisible: true,
        labelStyle: 0,
        numericValue: null,
        command: '(3,0)',
        algorithmXML: '',
        value: 'M=(3,0)',
      },
    ],
  });
  assert.equal(result.checks.find(c => c.id === 'midpoint')!.status, 'failed');
});
await test('numeric 1 cannot impersonate a native boolean predicate', () => {
  const req = parseRequest(sample);
  const facts = {
    engineVersion: 'test',
    scripts: [],
    objects: [
      {
        label: 'ggbCheck6',
        exists: true,
        defined: true,
        type: 'numeric',
        independent: true,
        parents: [],
        coordinates: null,
        color: '#000000',
        labelVisible: false,
        labelStyle: 0,
        numericValue: 1,
        command: '1',
        algorithmXML: '',
        value: '1',
      },
    ],
  };
  assert.equal(
    verifyRequest(req, facts).checks.find(c => c.id === 'midpointRelation')!
      .status,
    'failed',
  );
});
await test('v2 requires declared outputs and validates interaction samples without pretending to execute them', async () => {
  const full = JSON.parse(
    await readFile(
      new URL('../../examples/triangle.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(parseRequest(full).interactions.length, 1);
  assert.throws(() => parseRequest({...sample, outputs: []}));
  assert.throws(() => parseRequest({...sample, outputs: ['Unknown']}));
  assert.throws(() =>
    parseRequest({
      ...full,
      interactions: full.interactions.map((x: object) => ({
        ...x,
        checks: ['unknown'],
      })),
    }),
  );
  const noOutputs = {...sample} as Partial<Request>;
  delete noOutputs.outputs;
  assert.throws(() => parseRequest(noOutputs));
});
await test('capacity limits reject oversized expressions, original text and interaction arrays', () => {
  for (const data of [
    {...sample, source: 'X'.repeat(4001)},
    {
      ...sample,
      program: sample.program.map((step, index) =>
        index === 0 ? {...step, expression: '1' + ' '.repeat(1000)} : step,
      ),
    },
    {
      ...sample,
      interactions: Array.from({length: 21}, (_, index) => ({
        id: `move${index}`,
        requirement: 'geometry',
        kind: 'drag',
        label: 'A',
        from: [0, 0],
        to: [1, 1],
        checks: ['midpointRelation'],
      })),
    },
  ]) {
    assert.throws(() => parseRequest(data));
  }
});
await test('drag samples reject equal endpoints and undeclared references without launching an engine', async () => {
  const full = JSON.parse(
    await readFile(
      new URL('../../examples/triangle.json', import.meta.url),
      'utf8',
    ),
  );
  const variants = [
    {
      ...full,
      interactions: full.interactions.map((sample: object) => ({
        ...sample,
        to: (sample as {from: number[]}).from,
      })),
    },
    {
      ...full,
      interactions: full.interactions.map((sample: object) => ({
        ...sample,
        label: 'Z',
      })),
    },
    {
      ...full,
      interactions: full.interactions.map((sample: object) => ({
        ...sample,
        requirement: 'unknown',
      })),
    },
  ];
  for (const data of variants) {
    assert.throws(
      () => parseRequest(data),
      /INPUT_INVALID|endpoints|Invalid interaction/,
    );
  }
});

await test('twenty underscore drag ids pass preflight without changing their names', async () => {
  const full = parseRequest(
    JSON.parse(
      await readFile(
        new URL('../../examples/triangle.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const interactions = Array.from({length: 20}, (_, index) => ({
    ...full.interactions[0]!,
    id: `move_A_${index}`,
  }));
  const request = parseRequest({...full, interactions});
  assert.deepEqual(
    request.interactions.map(sample => sample.id),
    interactions.map(sample => sample.id),
  );
});
