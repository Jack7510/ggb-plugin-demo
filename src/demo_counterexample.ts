/**
 * @fileoverview 测试专用正反例演示：先交付完整案例，再证明静态中点反例被
 * 依赖门禁拒绝，最后把反例修成真实中点并重新交付。退出 0 只表示预期结果
 * 全部被观测到，不表示错误构图成功。
 */

import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDelivery} from './delivery.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('./cli.js', import.meta.url));
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface BuildRun {
  status: number | null;
  stdout: string;
  stderr: string;
}
interface DeliveryResponse {
  ok: boolean;
  result: {delivery: string};
}
interface ErrorResponse {
  ok: boolean;
  error: {code: string; diagnostics?: string};
}
interface Verification {
  status: string;
  mouseInteraction: string;
  requirements: {id: string; status: string}[];
  interactions: {
    id: string;
    status: string;
    reasons: string[];
  }[];
  reports: {
    phase: string;
    ok: boolean;
    checks: {
      id: string;
      status: string;
      actual: {
        label: string;
        independent: boolean;
        parents: string[];
        coordinates: number[] | null;
      } | null;
    }[];
  }[];
}
interface OpenRequest {
  title: string;
  source: string;
  requirements: {id: string; description: string}[];
  program: {label: string; expression: string}[];
  styles: unknown[];
  checks: unknown[];
  outputs: string[];
  interactions: unknown[];
  [key: string]: unknown;
}
/** 启动真实 CLI build；超时由子进程终止，不把挂起当成通过。 */
function runBuild(request: string): Promise<BuildRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cli, 'build', '--request', request],
      {
        timeout: 180_000,
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => {
      stdout += String(data);
    });
    child.stderr.on('data', data => {
      stderr += String(data);
    });
    child.on('error', reject);
    child.on('close', status => resolve({status, stdout, stderr}));
  });
}
async function save(name: string, value: unknown) {
  await writeFile(name, JSON.stringify(value, null, 2) + '\n');
}
async function pngEvidence(path: string): Promise<void> {
  const bytes = await readFile(path);
  if (!bytes.subarray(0, 8).equals(png)) {
    throw new Error('Expected a real PNG screenshot at ' + path);
  }
}
/** 检查交付对象并读出交互报告，避免只信任 CLI 的 ok 文本。 */
async function assertDelivery(path: string) {
  const delivery = await readDelivery(path);
  const report = JSON.parse(
    (await readFile(join(path, 'verification.json'))).toString(),
  ) as Verification;
  if (
    report.status !== 'passed' ||
    report.mouseInteraction !== 'verified' ||
    !report.requirements.every(
      requirement => requirement.status === 'passed',
    ) ||
    !report.interactions.length ||
    report.interactions.some(item => item.status !== 'passed')
  ) {
    throw new Error('Delivered report lacks passed mouse interaction evidence');
  }
  for (const item of report.interactions) {
    await pngEvidence(join(path, `interaction-${item.id}-before.png`));
    await pngEvidence(join(path, `interaction-${item.id}-after.png`));
  }
  return {delivery, report};
}
/**
 * 运行正例、反例和修复例。反例必须由初始依赖检查拒绝；保留其独立诊断目录。
 */
export async function main() {
  await mkdir(join(root, 'output'), {recursive: true});
  const directory = await mkdtemp(join(root, 'output/demo-counterexample-'));
  const positiveRequest = join(root, 'examples/triangle.json');
  const negativeRequest = join(root, 'examples/triangle-counterexample.json');

  const positive = await runBuild(positiveRequest);
  await save(join(directory, 'positive.stdout.json'), positive.stdout);
  await save(join(directory, 'positive.stderr.json'), positive.stderr);
  if (positive.status !== 0) {
    throw new Error('Positive full case failed: ' + positive.stderr);
  }
  const positiveResponse = JSON.parse(positive.stdout) as DeliveryResponse;
  const positiveEvidence = await assertDelivery(
    positiveResponse.result.delivery,
  );

  const negative = await runBuild(negativeRequest);
  await save(join(directory, 'negative.stdout.json'), negative.stdout);
  await save(join(directory, 'negative.stderr.json'), negative.stderr);
  if (negative.status !== 1 || negative.stdout !== '') {
    throw new Error(
      'Counterexample was not rejected as a failed build: ' + negative.stdout,
    );
  }
  const negativeError = JSON.parse(negative.stderr) as ErrorResponse;
  const diagnostics = negativeError.error.diagnostics;
  if (negativeError.error.code !== 'VERIFICATION_FAILED' || !diagnostics) {
    throw new Error('Counterexample did not fail at dependency verification');
  }
  const negativeVerification = JSON.parse(
    (await readFile(join(diagnostics, 'verification.json'))).toString(),
  ) as Verification;
  const failed = negativeVerification.reports
    .flatMap(report => report.checks)
    .find(check => check.id === 'midpoint' && check.status !== 'passed');
  const staticM = failed?.actual;
  if (
    negativeVerification.status !== 'failed' ||
    negativeVerification.mouseInteraction !== 'requested-not-verified' ||
    !failed ||
    !staticM ||
    staticM.independent !== true ||
    staticM.parents.length !== 0 ||
    JSON.stringify(staticM.coordinates) !== '[3,0]'
  ) {
    throw new Error('Counterexample rejection lacks the expected native facts');
  }
  if (
    await readFile(join(diagnostics, 'manifest.json')).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(
      'Rejected counterexample must not contain a delivery manifest',
    );
  }
  await pngEvidence(join(diagnostics, 'constructed.png'));

  // 保留原始反例请求，只在测试演示的独立文件中做真实中点修复。
  const repairedRequest = JSON.parse(
    (await readFile(negativeRequest)).toString(),
  ) as OpenRequest;
  repairedRequest.title = 'TEST-ONLY repaired counterexample: native midpoint';
  repairedRequest.source =
    'TEST-ONLY repaired variant: the same requirements and mouse drag, with M=Midpoint(A,B) instead of the static (3,0).';
  repairedRequest.program = repairedRequest.program.map(step =>
    step.label === 'M' ? {...step, expression: 'Midpoint(A,B)'} : step,
  );
  const repairedPath = join(directory, 'repaired-request.json');
  await save(repairedPath, repairedRequest);
  const repaired = await runBuild(repairedPath);
  await save(join(directory, 'repaired.stdout.json'), repaired.stdout);
  await save(join(directory, 'repaired.stderr.json'), repaired.stderr);
  if (repaired.status !== 0) {
    throw new Error('Repaired midpoint did not deliver: ' + repaired.stderr);
  }
  const repairedResponse = JSON.parse(repaired.stdout) as DeliveryResponse;
  const repairedEvidence = await assertDelivery(
    repairedResponse.result.delivery,
  );

  const summary = {
    ok: true,
    meaning:
      'Exit 0 means the expected rejection of the static midpoint was observed; it does not mean the wrong construction succeeded.',
    positiveDelivery: positiveEvidence.delivery.directory,
    negative: {
      expected: 'VERIFICATION_FAILED before any mouse drag',
      observedCode: negativeError.error.code,
      diagnostics,
      failedCheck: failed.id,
      actual: staticM,
      interactionStatus: negativeVerification.interactions[0]?.status,
      screenshot: join(diagnostics, 'constructed.png'),
    },
    repairedDelivery: repairedEvidence.delivery.directory,
    summary: directory,
  };
  await save(join(directory, 'summary.json'), summary);

  process.stdout.write(
    [
      'POSITIVE FULL CASE: delivered',
      '  delivery: ' + positiveEvidence.delivery.directory,
      '  initial + reloaded + interaction evidence passed readDelivery',
      '',
      'NEGATIVE COUNTEREXAMPLE: EXPECTED REJECTION OBSERVED',
      '  code: ' + negativeError.error.code,
      '  diagnostics: ' + diagnostics,
      '  underlying rejection: initial midpoint check failed;',
      '    M independent=' +
        staticM.independent +
        ', parents=' +
        JSON.stringify(staticM.parents) +
        ', coordinates=' +
        JSON.stringify(staticM.coordinates),
      '  screenshot: ' + join(diagnostics, 'constructed.png'),
      '  drag sample status: ' +
        String(negativeVerification.interactions[0]?.status),
      '  This wrong construction was rejected; it is not a delivery.',
      '',
      'REPAIRED COUNTEREXAMPLE: delivered',
      '  delivery: ' + repairedEvidence.delivery.directory,
      '',
      'Exit 0 means the expected rejection was correctly observed, not that the wrong construction succeeded.',
      'Summary: ' + join(directory, 'summary.json'),
    ].join('\n') + '\n',
  );
}

await main();
