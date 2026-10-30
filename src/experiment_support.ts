/**
 * @fileoverview 固定三角形回归的预期条件；这些案例常量不参与通用 CLI 的请求分派。
 */

import assert from 'node:assert/strict';
import type {Facts} from './verify.js';
export {startServer} from './server.js';

/** 固定页面在共享事实之上附加的原生中点探针。 */
export interface Snapshot extends Facts {
  midpoint: {defined: boolean; value: number};
}
/** 固定案例的独立回归预期，不是题型路由或通用数学规则。 */
export function verify(snapshot: Snapshot, version: string): void {
  assert.equal(
    snapshot.engineVersion,
    version,
    'Actual engine version must match runtime lock',
  );
  for (const object of snapshot.objects) {
    assert.ok(
      object.exists && object.defined,
      `${object.label} native object exists and is defined`,
    );
  }
  const facts = new Map(snapshot.objects.map(o => [o.label, o]));
  // getObjectType 对三顶点 Polygon 返回 triangle，与 XML 的 polygon 表述不同。
  const expected = {
    A: 'point',
    B: 'point',
    C: 'point',
    M: 'point',
    CM: 'segment',
    tri: 'triangle',
  };
  for (const [label, type] of Object.entries(expected)) {
    const o = facts.get(label);
    assert.ok(o?.exists && o.defined, `${label} must exist and be defined`);
    assert.equal(o.type, type, `${label} native type`);
  }
  for (const [label, coords] of Object.entries({
    A: [0, 0],
    B: [6, 0],
    C: [2, 4],
    M: [3, 0],
  })) {
    assert.deepEqual(
      facts.get(label)!.coordinates,
      coords,
      `${label} coordinates`,
    );
  }
  // 坐标相等只能核对初态，仍须独立确认 M 和 CM 的原生父对象关系。
  for (const [label, parents] of Object.entries({
    M: ['A', 'B'],
    CM: ['C', 'M'],
    tri: ['A', 'B', 'C'],
  })) {
    assert.equal(
      facts.get(label)!.independent,
      false,
      `${label} must have a native dependency`,
    );
    assert.deepEqual(
      facts.get(label)!.parents,
      parents,
      `${label} native algorithm inputs`,
    );
  }
  for (const label of ['M', 'CM']) {
    assert.equal(facts.get(label)!.color, '#FF0000', `${label} red`);
  }
  for (const label of ['A', 'B', 'C', 'M']) {
    assert.equal(
      facts.get(label)!.labelVisible,
      true,
      `${label} label visibility`,
    );
    assert.equal(facts.get(label)!.labelStyle, 0, `${label} name label`);
  }
  assert.equal(
    snapshot.midpoint.defined,
    true,
    'Native midpoint predicate defined',
  );
  assert.equal(snapshot.midpoint.value, 1, 'Native midpoint predicate true');
}
