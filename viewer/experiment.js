/**
 * @fileoverview 固定回归案例的原生命令；通用执行路径不依赖本文件的三角形常量。
 */

window.construct = () => {
  const api = window.engine;
  // 这些坐标只属于固定技术案例；新题必须通过请求进入通用 CLI。
  const commands = [
    'A=(0,0)',
    'B=(6,0)',
    'C=(2,4)',
    'tri=Polygon(A,B,C)',
    'M=Midpoint(A,B)',
    'CM=Segment(C,M)',
    'midpointOK=AreEqual(M,Midpoint(A,B))',
  ];
  for (const command of commands) {
    if (!api.evalCommand(command)) {
      throw new Error(`Native command failed: ${command}`);
    }
  }
  for (const label of ['M', 'CM']) {
    api.setColor(label, 255, 0, 0);
  }
  for (const label of ['A', 'B', 'C', 'M']) {
    api.setLabelVisible(label, true);
    api.setLabelStyle(label, 0);
  }
  api.setVisible('midpointOK', false);
  api.setCoordSystem(-2, 8, -2, 6);
  return commands;
};
// 在通用采集上附加固定探针，避免复制整套原生事实读取逻辑。
const generalSnapshot = window.snapshot;
window.snapshot = () => ({
  ...generalSnapshot(),
  midpoint: {
    defined: window.engine.isDefined('midpointOK'),
    value: window.engine.getValue('midpointOK'),
  },
});
