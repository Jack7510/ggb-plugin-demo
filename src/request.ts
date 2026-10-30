/**
 * @fileoverview 模型请求的结构与副作用边界；数学语法和重载仍由 GeoGebra 解释。
 */

import {readFile, stat} from 'node:fs/promises';
import {Ajv} from 'ajv';
import {ToolError} from './errors.js';

/** 独立要求的标识和原文说明，用于追踪检查覆盖，不充当通过证据。 */
export interface Requirement {
  id: string;
  description: string;
}
/** 原生表达式及其主输出标签；标签和数学含义交由 GeoGebra 解释。 */
export interface Step {
  label: string;
  expression: string;
}
/** 受控显示属性，避免通过用户脚本或 Set* 命令修改画布。 */
export interface Style {
  label: string;
  requirement: string;
  color?: string;
  labelVisible?: boolean;
}
/** 对象事实或原生布尔探针，由共享核验器读取实际事实后判定。 */
export type Check = {id: string; requirement: string} & (
  | {
      kind: 'object';
      label: string;
      type?: string;
      parents?: string[];
      coordinates?: number[];
    }
  | {kind: 'boolean'; expression: string}
);
/** 原题、构型选择与全部声明要求；字段含义以 v2 schema 和契约为准。 */
export interface Request {
  schemaVersion: 2;
  title: string;
  /** 保存用户原题，不能用模型改写后的简化题替代。 */
  source: string;
  /** 初始坐标等演示选择，与原题给定条件分开保存。 */
  choices: string[];
  /** 声明原生对象标签；不是用户可指定的磁盘路径。 */
  outputs: string[];
  /** 结构预检接受样本，但执行前仍须通过能力门禁。 */
  interactions: {
    id: string;
    requirement: string;
    kind: 'drag';
    label: string;
    from: number[];
    to: number[];
    checks: string[];
  }[];
  requirements: Requirement[];
  program: Step[];
  styles: Style[];
  checks: Check[];
  /** 顺序为 xmin、xmax、ymin、ymax，只影响显示范围。 */
  view: number[];
}
const ajv = new Ajv({allErrors: true, strict: true});
// schema 只编译一次；每次输入仍重新验证，不缓存模型请求的通过结果。
const validate = ajv.compile<Request>(
  JSON.parse(
    await readFile(
      new URL('../../schemas/request.schema.json', import.meta.url),
      'utf8',
    ),
  ),
);
const reserved = /^ggbCheck/i;
// Side-effect policy, not a mathematical command whitelist or a problem router.
const forbidden =
  /^(?:Set.*|Execute|Run.*Script|JavaScript|ReadText|Open.*|Export.*|Delete|Rename|Start.*|PlaySound|UpdateConstruction|Zoom.*|Pan|SelectObjects|Show.*|Hide.*|Button|InputBox|Checkbox|Turtle.*|Random.*|Shuffle|Sample)$/i;
/** 检查表达式的词法和引用边界，不模拟 GeoGebra 的数学解析器。 */
export function expression(text: string, known: Set<string>): void {
  // 赋值由工具统一生成；表达式只允许比较等号，不能夹带第二条命令。
  if (
    !/^[A-Za-z0-9_+\-*/^().,[\]{} <>=!]+$/.test(text) ||
    /(?<![<>=!])=(?!=)/.test(text) ||
    /\/\/|\/\*|\*\*/.test(text)
  ) {
    throw new ToolError(
      'INPUT_INVALID',
      'Expression contains unsupported syntax, strings, assignment or script delimiters',
    );
  }
  // 先去掉数值字面量，避免把 1e-3 中的 e 当成对象引用。
  const tokens = text.replace(/\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b/g, '0');
  for (const match of tokens.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)) {
    const name = match[0];
    if (reserved.test(name) || forbidden.test(name)) {
      throw new ToolError(
        'INPUT_INVALID',
        `Forbidden or reserved identifier: ${name}`,
      );
    }
    const tail = tokens.slice(match.index! + name.length).trimStart();
    // 调用名交给原生引擎解析；这里只约束副作用，不枚举数学命令。
    if (tail.startsWith('(') || tail.startsWith('[')) {
      continue;
    }
    if (!known.has(name) && !['pi', 'e', 'true', 'false'].includes(name)) {
      throw new ToolError(
        'INPUT_INVALID',
        `Unknown or forward reference: ${name}`,
      );
    }
  }
}
/** 验证结构、引用和声明覆盖；不证明原题条件提取完整或数学成立。 */
export function parseRequest(data: unknown): Request {
  if (!validate(data)) {
    throw new ToolError('INPUT_INVALID', ajv.errorsText(validate.errors));
  }
  const request = data;
  const requirements = new Set(request.requirements.map(r => r.id));
  if (requirements.size !== request.requirements.length) {
    throw new ToolError('INPUT_INVALID', 'Duplicate requirement id');
  }
  // 按程序顺序建立可引用标签，防止提前使用尚未构造的对象。
  const known = new Set<string>();
  for (const step of request.program) {
    if (known.has(step.label) || reserved.test(step.label)) {
      throw new ToolError(
        'INPUT_INVALID',
        `Duplicate or reserved label: ${step.label}`,
      );
    }
    expression(step.expression, known);
    known.add(step.label);
  }
  const ids = new Set<string>();
  // 覆盖仅表示要求关联了声明，不表示对应数学检查已经执行或通过。
  const covered = new Set<string>();
  const objects = new Set<string>();
  for (const check of request.checks) {
    if (ids.has(check.id)) {
      throw new ToolError('INPUT_INVALID', 'Duplicate check id');
    }
    ids.add(check.id);
    covered.add(check.requirement);
    if (!requirements.has(check.requirement)) {
      throw new ToolError('INPUT_INVALID', 'Unknown check requirement');
    }
    if (check.kind === 'boolean') {
      expression(check.expression, known);
    } else {
      objects.add(check.label);
      for (const label of [check.label, ...(check.parents ?? [])]) {
        if (!known.has(label)) {
          throw new ToolError(
            'INPUT_INVALID',
            `Unknown object reference: ${label}`,
          );
        }
      }
    }
  }
  // 每个主输出都要显式检查，避免只生成画面而漏掉关键对象。
  for (const step of request.program) {
    if (!objects.has(step.label)) {
      throw new ToolError(
        'INPUT_INVALID',
        `Missing object check: ${step.label}`,
      );
    }
  }
  for (const style of request.styles) {
    if (!known.has(style.label) || !requirements.has(style.requirement)) {
      throw new ToolError('INPUT_INVALID', 'Unknown style reference');
    }
    covered.add(style.requirement);
  }
  // 同一对象只接受一份样式声明，不能依赖后写覆盖掩盖冲突要求。
  if (
    new Set(request.styles.map(s => s.label)).size !== request.styles.length
  ) {
    throw new ToolError('INPUT_INVALID', 'Duplicate style label');
  }
  // 交付对象必须同时有原生构造和检查依据，不能只在清单中写一个名字。
  for (const label of request.outputs) {
    if (!known.has(label) || !objects.has(label)) {
      throw new ToolError(
        'INPUT_INVALID',
        'Declared output lacks a program object/check: ' + label,
      );
    }
  }
  const interactions = new Set<string>();
  for (const sample of request.interactions) {
    if (
      interactions.has(sample.id) ||
      !requirements.has(sample.requirement) ||
      !known.has(sample.label) ||
      sample.checks.some(id => !ids.has(id))
    ) {
      throw new ToolError(
        'INPUT_INVALID',
        'Invalid interaction reference or duplicate id',
      );
    }
    // 相同端点不是有效移动样本；真正的鼠标执行由后续能力门禁决定。
    if (JSON.stringify(sample.from) === JSON.stringify(sample.to)) {
      throw new ToolError('INPUT_INVALID', 'Drag endpoints must differ');
    }
    interactions.add(sample.id);
    covered.add(sample.requirement);
  }
  for (const id of requirements) {
    if (!covered.has(id)) {
      throw new ToolError('INPUT_INVALID', `Unverified requirement: ${id}`);
    }
  }
  if (!(
    request.view[0]! < request.view[1]! && request.view[2]! < request.view[3]!
  )) {
    throw new ToolError('INPUT_INVALID', 'Invalid view bounds');
  }
  return request;
}
/** 有容量限制地读取请求，并把文件/JSON 错误转换为稳定的输入错误。 */
export async function readRequest(path: string): Promise<Request> {
  try {
    // 在完整读取和 JSON 解析前先限制文件大小，字段容量另由 schema 检查。
    if ((await stat(path)).size > 1024 * 1024) {
      throw new ToolError('INPUT_INVALID', 'Request exceeds 1 MiB');
    }
    return parseRequest(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    throw new ToolError('INPUT_INVALID', String(error));
  }
}
