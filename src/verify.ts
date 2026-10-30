/**
 * @fileoverview 只根据原生事实判定声明条件，不生成数学事实，也不接受模型给出的通过结论。
 */

import type {Request} from './request.js';
/** 原生滑块控件的只读设置；普通对象没有该字段。 */
export interface SliderFact {
  min: number;
  max: number;
  width: number;
  horizontal: boolean;
  showAlgebra: boolean;
}
/** 单个对象的引擎观测值；父对象来自原生算法 XML。 */
export interface Fact {
  label: string;
  exists: boolean;
  /** 对象存在不代表已定义；非法交点等对象也可能拥有标签。 */
  defined: boolean;
  type: string;
  independent: boolean;
  /** 原生算法的有序输入，不能从当前坐标推测动态依赖。 */
  parents: string[];
  coordinates: number[] | null;
  color: string;
  labelVisible: boolean;
  labelStyle: number;
  /** 滑块设置来自对象 XML；普通 numeric 没有该字段。 */
  slider?: SliderFact | null;
  /** 仅为原生 boolean 读取数值；显示字符串不作为布尔通过依据。 */
  numericValue: number | null;
  command: string;
  /** 保留原始证据；字段大小写属于现有文件契约，不随代码命名调整。 */
  algorithmXML: string;
  value: string;
}
/** 全量引擎观测，包含原生自动生成的对象和单独审计的脚本内容。 */
export interface Facts {
  engineVersion: string;
  objects: Fact[];
  scripts: string[];
}
/** 当前通用核验支持的原生对象类型；其他类型必须失败而不是跳过。 */
export const SUPPORTED_TYPES = new Set([
  'point',
  'line',
  'segment',
  'triangle',
  'polygon',
  'circle',
  'conic',
  'vector',
  'numeric',
  'boolean',
]);
/** 只核验被交互样本选中的检查；探针索引仍按完整请求位置读取。 */
export interface CheckSelection {
  ids?: ReadonlySet<string>;
  /** 拖动后移动点及其中点会改变坐标；交互阶段只核对依赖、类型和布尔不变量。 */
  stripCoordinates?: boolean;
}
/** 按完整请求索引读取原生检查，可只返回选中项或去掉阶段相关的坐标条件。 */
export function verifyChecks(
  request: Request,
  facts: Facts,
  options: CheckSelection = {},
) {
  const objects = new Map(facts.objects.map(o => [o.label, o]));
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const results: {
    id: string;
    requirement: string;
    expected: Request['checks'][number];
    actual: Fact | null;
    status: 'passed' | 'failed';
  }[] = [];
  request.checks.forEach((check, index) => {
    if (options.ids && !options.ids.has(check.id)) {
      return;
    }
    let expected = check;
    if (options.stripCoordinates && check.kind === 'object') {
      // 移除坐标但保留检查 id/索引，避免重排原生 ggbCheck<索引> 探针。
      const withoutCoordinates = {...check};
      delete withoutCoordinates.coordinates;
      expected = withoutCoordinates;
    }
    const actual = objects.get(
      expected.kind === 'object' ? expected.label : `ggbCheck${index}`,
    );
    let ok = !!actual?.exists && !!actual.defined;
    if (expected.kind === 'boolean') {
      // 必须同时匹配类型和真值，禁止把 numeric 类型的 1 当成成功探针。
      ok &&= actual?.type === 'boolean' && actual.numericValue === 1;
    } else {
      if (expected.type !== undefined) {
        ok &&= actual?.type === expected.type;
      }
      // 静态点即使恰好位于中点，也不能替代由 A、B 驱动的原生依赖。
      if (expected.parents !== undefined) {
        ok &&=
          same(actual?.parents, expected.parents) &&
          actual?.independent === (expected.parents.length === 0);
      }
      // 固定容差是工具约束，模型不能通过请求放宽它来消除失败。
      if (expected.coordinates !== undefined) {
        ok &&=
          actual?.type === 'point' &&
          !!actual.coordinates &&
          expected.coordinates.every(
            (n, i) =>
              Number.isFinite(actual.coordinates![i]) &&
              Math.abs(n - actual.coordinates![i]!) <= 1e-9,
          );
      }
    }
    results.push({
      id: expected.id,
      requirement: expected.requirement,
      expected,
      actual: actual ?? null,
      status: ok ? 'passed' : 'failed',
    });
  });
  return results;
}
/** 样式与点名独立复核；颜色或标签显示不符时不能靠检查通过来补偿。 */
export function verifyStyles(request: Request, facts: Facts) {
  const objects = new Map(facts.objects.map(o => [o.label, o]));
  return request.styles.map((style, index) => {
    const actual = objects.get(style.label);
    const ok =
      !!actual?.exists &&
      actual.defined &&
      (style.color === undefined || actual.color === style.color) &&
      (style.labelVisible === undefined ||
        (actual.labelVisible === style.labelVisible &&
          actual.labelStyle === 0));
    return {
      id: `style-${index}`,
      requirement: style.requirement,
      expected: style,
      actual: actual ?? null,
      status: ok ? 'passed' : 'failed',
    };
  });
}
/** 按声明检查原生事实；数值 1、静态同坐标和缺证据均不能冒充完整通过。 */
export function verifyRequest(request: Request, facts: Facts) {
  const results = verifyChecks(request, facts);
  const styles = verifyStyles(request, facts);
  // 同样审计自动生成的边和探针，不能只检查声明输出后忽略其他失败对象。
  const unsupported = facts.objects
    .filter(o => !SUPPORTED_TYPES.has(o.type))
    .map(o => ({label: o.label, type: o.type}));
  const allDefined =
    facts.objects.length > 0 && facts.objects.every(o => o.exists && o.defined);
  return {
    allDefined,
    unsupported,
    ok:
      allDefined &&
      unsupported.length === 0 &&
      [...results, ...styles].every(c => c.status === 'passed'),
    checks: [...results, ...styles],
  };
}
/** 比较稳定的数学/样式字段及脚本，避免依赖无关的 XML 序列化细节。 */
export function compareReload(before: Facts, after: Facts) {
  // 按标签规范化对象顺序；比较内容而非引擎枚举顺序或截图像素。
  const content = (f: Facts) =>
    f.objects
      .map(
        ({
          label,
          type,
          independent,
          parents,
          coordinates,
          color,
          labelVisible,
          labelStyle,
          slider,
          command,
          value,
        }) => ({
          label,
          type,
          independent,
          parents,
          coordinates,
          color,
          labelVisible,
          labelStyle,
          slider,
          command,
          value,
        }),
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  return (
    JSON.stringify(content(before)) === JSON.stringify(content(after)) &&
    JSON.stringify(before.scripts) === JSON.stringify(after.scripts)
  );
}
/** 逐条要求的汇总只引用已落盘检查/样式/交互结果，不新增数学判断。 */
interface ReportCheck {
  id: string;
  requirement: string;
  status: string;
}
interface PhaseReport {
  phase: string;
  checks: ReportCheck[];
}
interface InteractionEvidence {
  id: string;
  requirement: string;
  status: string;
  checks: ReportCheck[];
  invariants: ReportCheck[];
  styles: ReportCheck[];
}
/**
 * 将初态、重载和每个交互样本的检查映射回原题要求。
 * 任一样本失败则要求失败；没有任何证据则为未验证，不能记为通过。
 */
export function summarizeRequirements(
  request: Request,
  reports: PhaseReport[],
  interactions: InteractionEvidence[],
) {
  return request.requirements.map(requirement => {
    const initial =
      reports
        .find(report => report.phase === 'initial')
        ?.checks.filter(check => check.requirement === requirement.id) ?? [];
    const reloaded =
      reports
        .find(report => report.phase === 'reloaded')
        ?.checks.filter(check => check.requirement === requirement.id) ?? [];
    const samples = interactions.filter(
      sample =>
        sample.requirement === requirement.id ||
        [...sample.checks, ...sample.invariants, ...sample.styles].some(
          check => check.requirement === requirement.id,
        ),
    );
    const sampleChecks = samples.flatMap(sample =>
      [...sample.checks, ...sample.invariants, ...sample.styles].filter(
        check => check.requirement === requirement.id,
      ),
    );
    const all = [...initial, ...reloaded, ...sampleChecks];
    const failed =
      all.some(check => check.status !== 'passed') ||
      samples.some(sample => sample.status !== 'passed');
    const status =
      !all.length && !samples.length
        ? 'unverified'
        : failed
          ? 'failed'
          : 'passed';
    return {
      id: requirement.id,
      description: requirement.description,
      status,
      evidence: {
        initial: initial.map(check => check.id),
        reloaded: reloaded.map(check => check.id),
        interactions: samples.map(sample => ({
          id: sample.id,
          status: sample.status,
          checks: [
            ...new Set(
              [...sample.checks, ...sample.invariants, ...sample.styles]
                .filter(check => check.requirement === requirement.id)
                .map(check => check.id),
            ),
          ],
        })),
      },
    };
  });
}
