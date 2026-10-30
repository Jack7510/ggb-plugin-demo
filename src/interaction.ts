/**
 * @fileoverview 拖动样本的通用证据判定；只读取真实鼠标操作前后的原生事实，
 * 不把模型声明的样本坐标或 passed 文本当作联动通过。
 */

import type {Request} from './request.js';
import type {Fact, Facts} from './verify.js';
import {SUPPORTED_TYPES, verifyChecks, verifyStyles} from './verify.js';

/** 固定的鼠标证据容差，独立于模型可写的 1e-9 数学检查容差。 */
export const DRAG_HIT_RADIUS_PX = 8;
export const DRAG_TARGET_TOLERANCE_PX = 2;
export const DRAG_MIN_TRAVEL_PX = 2;
const DRAG_START_TOLERANCE = 1e-9;
const DRAG_UNCHANGED_TOLERANCE = 1e-9;
const DRAG_VIEW_TOLERANCE = 1e-9;
/** 候选对象只在起点附近记录，便于解释目标命中是否有歧义。 */
const DRAG_CANDIDATE_RADIUS_PX = 20;

/** 二维画布的可视世界范围与像素换算；由引擎 getViewProperties 返回。 */
export interface ViewProperties {
  left: number;
  top: number;
  width: number;
  height: number;
  xMin: number;
  yMin: number;
  invXscale: number;
  invYscale: number;
}

/** 屏幕像素坐标，用于 Playwright 的真实鼠标事件，不是几何坐标。 */
export interface PixelPoint {
  x: number;
  y: number;
}

/** 起点或目标附近的其他点；距离小于命中半径时不能确定抓住了谁。 */
export interface PointCandidate {
  label: string;
  pixel: PixelPoint;
  distancePx: number;
}

/** 每个样本独立加载的磁盘 GGB 身份和空 applet 证据。 */
export interface DragSourceEvidence {
  file: 'construction.ggb';
  sha256: string;
  freshContextEmptyCount: number;
  reloadedContentEqual: boolean;
}

/** 实际鼠标按下、连续移动、松开以及命中的对象候选。 */
export interface DragPointerEvidence {
  start: PixelPoint;
  target: PixelPoint;
  steps: number;
  down: boolean;
  up: boolean;
  hitRadiusPx: number;
  startCandidates: PointCandidate[];
  targetCandidates: PointCandidate[];
}

/** 保存到报告、可供独立重算的完整拖动输入。 */
export interface DragEvidence {
  source: DragSourceEvidence;
  pointer: DragPointerEvidence;
  viewBefore: ViewProperties;
  viewAfter: ViewProperties;
  visible: boolean;
  screenshots: {before: string; after: string};
}

/** 拖动样本的逐项结果；报告同时保留前后事实摘要和选中检查的原生 actual。 */
export interface DragReport {
  id: string;
  requirement: string;
  kind: 'drag';
  label: string;
  status: 'passed' | 'failed';
  reasons: string[];
  expected: {
    from: number[];
    to: number[];
    checks: string[];
  };
  source: DragSourceEvidence;
  pointer: DragPointerEvidence;
  viewBefore: ViewProperties;
  viewAfter: ViewProperties;
  visible: boolean;
  screenshots: {before: string; after: string};
  before: FactSummary | null;
  after: FactSummary | null;
  displacement: {
    world: [number, number];
    pixels: [number, number];
    distancePx: number;
  };
  targetError: {
    world: [number, number];
    pixels: [number, number];
  };
  unchangedIndependentPoints: FactSummary[];
  checks: ReturnType<typeof verifyChecks>;
  invariants: ReturnType<typeof verifyChecks>;
  styles: ReturnType<typeof verifyStyles>;
  allDefined: boolean;
  unsupported: {label: string; type: string}[];
  objectLabelsEqual: boolean;
  limitations: string[];
}
/** 报告中只保留判定需要的稳定事实，完整对象列表另存于阶段 JSON。 */
export interface FactSummary {
  label: string;
  exists: boolean;
  defined: boolean;
  type: string;
  independent: boolean;
  parents: string[];
  coordinates: number[] | null;
}
const limitations = [
  'A finite set of initial, reload and mouse-drag samples is not a general mathematical proof.',
  'The mouse gate proves this sample hit and moved the declared point; it does not prove all possible drags.',
];
/** 世界坐标到画布像素；纵向按屏幕向下增长，使用引擎返回的实际视口。 */
export function toPixels(
  coordinates: readonly number[],
  view: ViewProperties,
): PixelPoint {
  return {
    x: view.left + (coordinates[0]! - view.xMin) / view.invXscale,
    y: view.top + view.height - (coordinates[1]! - view.yMin) / view.invYscale,
  };
}
/** 检查视口字段是否可用于像素换算，拒绝 NaN、零比例或退化画布。 */
function validView(view: ViewProperties): boolean {
  return (
    [
      view.left,
      view.top,
      view.width,
      view.height,
      view.xMin,
      view.yMin,
      view.invXscale,
      view.invYscale,
    ].every(Number.isFinite) &&
    view.width > 0 &&
    view.height > 0 &&
    view.invXscale > 0 &&
    view.invYscale > 0
  );
}
/** 列出起点或目标附近的点，坐标来自原生对象，而不是请求中的期望值。 */
export function nearbyPoints(
  facts: Facts,
  view: ViewProperties,
  center: PixelPoint,
  exclude: string,
): PointCandidate[] {
  return facts.objects
    .filter(
      object =>
        object.type === 'point' &&
        object.exists &&
        object.defined &&
        object.coordinates &&
        object.label !== exclude,
    )
    .map(object => {
      const pixel = toPixels(object.coordinates!, view);
      return {
        label: object.label,
        pixel,
        distancePx: Math.hypot(pixel.x - center.x, pixel.y - center.y),
      };
    })
    .filter(candidate => candidate.distancePx <= DRAG_CANDIDATE_RADIUS_PX)
    .sort(
      (a, b) => a.distancePx - b.distancePx || a.label.localeCompare(b.label),
    );
}
/** 只保留声明字段，避免报告因无关原生字段变化而失去可比性。 */
function summarize(object: Fact): FactSummary {
  return {
    label: object.label,
    exists: object.exists,
    defined: object.defined,
    type: object.type,
    independent: object.independent,
    parents: object.parents,
    coordinates: object.coordinates,
  };
}
function close(a: number, b: number, tolerance: number): boolean {
  return (
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance
  );
}
function samePixels(a: PixelPoint, b: PixelPoint, tolerance = 0.5): boolean {
  return close(a.x, b.x, tolerance) && close(a.y, b.y, tolerance);
}
function sameView(a: ViewProperties, b: ViewProperties): boolean {
  return (
    validView(a) &&
    validView(b) &&
    close(a.left, b.left, DRAG_VIEW_TOLERANCE) &&
    close(a.top, b.top, DRAG_VIEW_TOLERANCE) &&
    close(a.width, b.width, DRAG_VIEW_TOLERANCE) &&
    close(a.height, b.height, DRAG_VIEW_TOLERANCE) &&
    close(a.xMin, b.xMin, DRAG_VIEW_TOLERANCE) &&
    close(a.yMin, b.yMin, DRAG_VIEW_TOLERANCE) &&
    close(a.invXscale, b.invXscale, DRAG_VIEW_TOLERANCE) &&
    close(a.invYscale, b.invYscale, DRAG_VIEW_TOLERANCE)
  );
}
/**
 * 判定一次真实拖动。输入是引擎前后事实及鼠标/视口证据；任何缺证据、
 * 目标歧义、未移动、关系失败或视口漂移都使样本失败，调用方不得交付。
 */
export function evaluateDrag(
  request: Request,
  sample: Request['interactions'][number],
  before: Facts,
  after: Facts,
  evidence: DragEvidence,
): DragReport {
  const reasons: string[] = [];
  const beforePoint =
    before.objects.find(o => o.label === sample.label) ?? null;
  const afterPoint = after.objects.find(o => o.label === sample.label) ?? null;
  const sampleChecks = new Set(sample.checks);
  const checks = verifyChecks(request, after, {ids: sampleChecks});
  const invariants = verifyChecks(request, after, {stripCoordinates: true});
  const styles = verifyStyles(request, after);
  const unsupported = after.objects
    .filter(object => !SUPPORTED_TYPES.has(object.type))
    .map(object => ({label: object.label, type: object.type}));
  const allDefined =
    after.objects.length > 0 &&
    after.objects.every(object => object.exists && object.defined);
  const labels = (facts: Facts) =>
    facts.objects
      .map(object => object.label)
      .sort((a, b) => a.localeCompare(b));
  const objectLabelsEqual =
    JSON.stringify(labels(before)) === JSON.stringify(labels(after));
  if (!validView(evidence.viewBefore) || !validView(evidence.viewAfter)) {
    reasons.push('Engine view properties are missing or invalid');
  }
  if (!sameView(evidence.viewBefore, evidence.viewAfter)) {
    reasons.push('The view panned or zoomed during the mouse drag');
  }
  if (!evidence.visible) {
    reasons.push('The declared drag point is not visible');
  }
  if (!beforePoint?.exists || !beforePoint.defined) {
    reasons.push('The declared drag point does not exist before the drag');
  }
  if (beforePoint?.type !== 'point' || beforePoint.independent !== true) {
    reasons.push('The declared drag point is not an independent point');
  }
  if (
    beforePoint?.coordinates === null ||
    beforePoint?.coordinates === undefined
  ) {
    reasons.push('The declared drag point has no coordinates');
  } else if (sample.from.length !== 2) {
    reasons.push('The sample start is not a two-dimensional coordinate');
  } else if (
    !close(
      beforePoint.coordinates[0]!,
      sample.from[0]!,
      DRAG_START_TOLERANCE,
    ) ||
    !close(beforePoint.coordinates[1]!, sample.from[1]!, DRAG_START_TOLERANCE)
  ) {
    reasons.push('The sample start does not match the actual point position');
  }
  const startPixel = beforePoint?.coordinates
    ? toPixels(beforePoint.coordinates, evidence.viewBefore)
    : null;
  const targetPixel = toPixels(sample.to, evidence.viewBefore);
  // 命中候选必须从拖动前事实和视口重算，不能只信调用方保存的候选数组。
  const startCandidates = startPixel
    ? nearbyPoints(before, evidence.viewBefore, startPixel, sample.label)
    : [];
  const targetCandidates = nearbyPoints(
    before,
    evidence.viewBefore,
    targetPixel,
    sample.label,
  );
  if (!startPixel || !samePixels(evidence.pointer.start, startPixel)) {
    reasons.push('The mouse-down pixel is not the computed point position');
  }
  if (!samePixels(evidence.pointer.target, targetPixel)) {
    reasons.push('The mouse target pixel is not the computed target position');
  }
  const inside = (pixel: PixelPoint) =>
    pixel.x >= evidence.viewBefore.left &&
    pixel.x <= evidence.viewBefore.left + evidence.viewBefore.width &&
    pixel.y >= evidence.viewBefore.top &&
    pixel.y <= evidence.viewBefore.top + evidence.viewBefore.height;
  if (!startPixel || !inside(startPixel) || !inside(targetPixel)) {
    reasons.push('The drag start or target is outside the visible canvas');
  }
  const ambiguous = startCandidates.filter(
    candidate => candidate.distancePx <= evidence.pointer.hitRadiusPx,
  );
  if (ambiguous.length) {
    reasons.push(
      'The mouse-down position is ambiguous: ' +
        ambiguous.map(candidate => candidate.label).join(', '),
    );
  }
  if (!evidence.pointer.down || !evidence.pointer.up) {
    reasons.push('The real mouse press or release was not observed');
  }
  if (evidence.pointer.steps < 2) {
    reasons.push('The drag was not a continuous mouse movement');
  }
  const unchangedIndependentPoints = before.objects
    .filter(
      object =>
        object.type === 'point' &&
        object.independent &&
        object.label !== sample.label,
    )
    .map(object => {
      const changed = after.objects.find(item => item.label === object.label);
      if (
        !changed ||
        !object.coordinates ||
        !changed.coordinates ||
        !close(
          object.coordinates[0]!,
          changed.coordinates[0]!,
          DRAG_UNCHANGED_TOLERANCE,
        ) ||
        !close(
          object.coordinates[1]!,
          changed.coordinates[1]!,
          DRAG_UNCHANGED_TOLERANCE,
        )
      ) {
        reasons.push('Another independent point moved: ' + object.label);
      }
      return summarize(object);
    });
  if (!afterPoint?.exists || !afterPoint.defined) {
    reasons.push('The declared drag point does not exist after the drag');
  }
  if (afterPoint?.type !== 'point' || afterPoint.independent !== true) {
    reasons.push('The dragged point lost its independent point identity');
  }
  const beforeCoordinates = beforePoint?.coordinates ?? null;
  const afterCoordinates = afterPoint?.coordinates ?? null;
  const displacementWorld: [number, number] = [
    beforeCoordinates && afterCoordinates
      ? afterCoordinates[0]! - beforeCoordinates[0]!
      : Number.NaN,
    beforeCoordinates && afterCoordinates
      ? afterCoordinates[1]! - beforeCoordinates[1]!
      : Number.NaN,
  ];
  const displacementPixels: [number, number] = [
    displacementWorld[0] / evidence.viewAfter.invXscale,
    -displacementWorld[1] / evidence.viewAfter.invYscale,
  ];
  const distancePx = Math.hypot(...displacementPixels);
  const targetWorld: [number, number] = [
    afterCoordinates ? afterCoordinates[0]! - sample.to[0]! : Number.NaN,
    afterCoordinates ? afterCoordinates[1]! - sample.to[1]! : Number.NaN,
  ];
  const targetPixels: [number, number] = [
    targetWorld[0] / evidence.viewAfter.invXscale,
    -targetWorld[1] / evidence.viewAfter.invYscale,
  ];
  if (!Number.isFinite(distancePx) || distancePx < DRAG_MIN_TRAVEL_PX) {
    reasons.push('The declared point did not visibly move under the mouse');
  }
  if (
    !Number.isFinite(targetPixels[0]) ||
    !Number.isFinite(targetPixels[1]) ||
    Math.abs(targetPixels[0]) > DRAG_TARGET_TOLERANCE_PX ||
    Math.abs(targetPixels[1]) > DRAG_TARGET_TOLERANCE_PX
  ) {
    reasons.push('The pointer did not reach the declared target position');
  }
  if (
    afterCoordinates !== null &&
    afterCoordinates.some(coordinate => !Number.isFinite(coordinate))
  ) {
    reasons.push('The dragged point has non-finite coordinates');
  }
  if (!evidence.source.reloadedContentEqual) {
    reasons.push('The sample load differs from the verified reloaded GGB');
  }
  if (evidence.source.freshContextEmptyCount !== 0) {
    reasons.push('The sample was not loaded into a new empty applet');
  }
  if (!objectLabelsEqual) {
    reasons.push('The drag created or removed native objects');
  }
  if (!allDefined) {
    reasons.push('At least one native object is undefined after the drag');
  }
  if (unsupported.length) {
    reasons.push('Unsupported native object types remain after the drag');
  }
  const failedNames = [
    ...new Set(
      [...checks, ...invariants, ...styles]
        .filter(item => item.status !== 'passed')
        .map(item => item.id),
    ),
  ];
  if (failedNames.length) {
    reasons.push('Failed after-drag checks: ' + failedNames.join(', '));
  }
  const status = reasons.length === 0 ? 'passed' : 'failed';
  return {
    id: sample.id,
    requirement: sample.requirement,
    kind: 'drag',
    label: sample.label,
    status,
    reasons,
    expected: {
      from: sample.from,
      to: sample.to,
      checks: sample.checks,
    },
    source: evidence.source,
    pointer: {
      ...evidence.pointer,
      startCandidates,
      targetCandidates,
    },
    viewBefore: evidence.viewBefore,
    viewAfter: evidence.viewAfter,
    visible: evidence.visible,
    screenshots: evidence.screenshots,
    before: beforePoint ? summarize(beforePoint) : null,
    after: afterPoint ? summarize(afterPoint) : null,
    displacement: {
      world: displacementWorld,
      pixels: displacementPixels,
      distancePx,
    },
    targetError: {world: targetWorld, pixels: targetPixels},
    unchangedIndependentPoints,
    checks,
    invariants,
    styles,
    allDefined,
    unsupported,
    objectLabelsEqual,
    limitations,
  };
}
