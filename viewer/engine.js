/**
 * @fileoverview 可信的 GeoGebra 页面桥接；请求只作为数据传入，不执行用户 JavaScript。
 */

window.ready = false;
const applet = new GGBApplet(
  {
    appName: 'classic',
    id: 'demoApplet',
    width: 1000,
    height: 650,
    language: 'en',
    showToolBar: false,
    showAlgebraInput: false,
    showMenuBar: false,
    enableFileFeatures: false,
    enableRightClick: false,
    useBrowserForJS: false,
    // 页面加载完成不等于引擎就绪，必须等原生 API 回调后才开放桥接。
    appletOnLoad(api) {
      window.engine = api;
      window.ready = true;
    },
  },
  true,
);
// 5.0 是官方包的目录布局，实际引擎版本另从 API 核对，不回退到 CDN。
applet.setHTML5Codebase('/runtime/GeoGebra/HTML5/5.0/web3d/');
applet.inject('ggb-element');
/** 采集全部原生对象，包括命令自动生成的边；不在页面中宣告核验通过。 */
window.snapshot = () => {
  const api = window.engine;
  const xmlDocument = new DOMParser().parseFromString(api.getXML(), 'text/xml');
  const sliders = new Map();
  for (const element of xmlDocument.querySelectorAll('element')) {
    const label = element.getAttribute('label');
    const slider = element.querySelector('slider');
    if (label && slider) {
      sliders.set(label, {
        min: Number(slider.getAttribute('min')),
        max: Number(slider.getAttribute('max')),
        width: Number(slider.getAttribute('width')),
        horizontal: slider.getAttribute('horizontal') === 'true',
        showAlgebra: slider.getAttribute('showAlgebra') === 'true',
      });
    }
  }
  const objects = Array.from(api.getAllObjectNames()).map(label => {
    const algorithmXML = api.getAlgorithmXML(label);
    const xml = new DOMParser().parseFromString(
      `<root>${algorithmXML}</root>`,
      'text/xml',
    );
    // 父对象来自原生算法输入，不能用数值或当前坐标反推依赖关系。
    const input = xml.querySelector('command > input');
    const type = api.getObjectType(label);
    return {
      label,
      exists: api.exists(label),
      defined: api.isDefined(label),
      type,
      independent: api.isIndependent(label),
      command: api.getCommandString(label, false),
      algorithmXML,
      parents: input ? Array.from(input.attributes, a => a.value) : [],
      coordinates:
        type === 'point' ? [api.getXcoord(label), api.getYcoord(label)] : null,
      numericValue: type === 'boolean' ? api.getValue(label) : null,
      color: api.getColor(label),
      labelVisible: api.getLabelVisible(label),
      labelStyle: api.getLabelStyle(label),
      slider: sliders.get(label) ?? null,
      value: api.getValueString(label, false),
    };
  });
  return {
    engineVersion: api.getVersion(),
    objects,
    scripts: Array.from(
      xmlDocument.querySelectorAll('javascript, ggbscript'),
      node => node.outerHTML,
    ),
  };
};
/** 等待原生导出回调，返回真正的 GGB 字节编码而非自制文件内容。 */
window.exportGgb = () =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('GGB export timeout')),
      30000,
    );
    window.engine.getBase64(value => {
      clearTimeout(timer);
      resolve(value);
    });
  });
/** 只负责装入已读取的文件字节；空 applet 和加载后的条件由 Node 侧核对。 */
window.loadDiskGgb = base64 =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('GGB reload timeout')),
      30000,
    );
    window.engine.setBase64(base64, () => {
      // 交付/预览只显示绘图区；在加载完成后再切换，避免重置点名显示。
      window.engine.setPerspective('G');
      clearTimeout(timer);
      resolve();
    });
  });

/** 执行 Node 侧已预检的原生表达式；本函数不读取用户 JavaScript。 */
window.runRequest = request => {
  const api = window.engine;
  for (const step of request.program) {
    if (api.exists(step.label)) {
      throw new Error('Label already exists: ' + step.label);
    }
    if (
      !api.evalCommand(step.label + '=' + step.expression) ||
      !api.exists(step.label)
    ) {
      throw new Error('Native construction failed: ' + step.label);
    }
  }
  // 探针标签按检查索引生成，必须与 verifyRequest 的映射保持一致。
  request.checks.forEach((check, index) => {
    if (
      check.kind === 'boolean' &&
      !api.evalCommand('ggbCheck' + index + '=' + check.expression)
    ) {
      throw new Error('Native predicate failed: ' + check.id);
    }
    if (check.kind === 'boolean') {
      api.setVisible('ggbCheck' + index, false);
    }
  });
  // 样式经固定 API 应用，不放行请求表达式中的任意副作用命令。
  for (const style of request.styles) {
    if (!api.exists(style.label)) {
      throw new Error('Style target missing');
    }
    if (style.color !== undefined) {
      const rgb = style.color
        .slice(1)
        .match(/../g)
        .map(value => parseInt(value, 16));
      api.setColor(style.label, ...rgb);
    }
    if (style.labelVisible !== undefined) {
      api.setLabelVisible(style.label, style.labelVisible);
      api.setLabelStyle(style.label, 0);
    }
  }
  // 视图范围只改变显示，不把演示坐标或缩放当成新的数学条件。
  api.setCoordSystem(...request.view);
  // 构建与预览都只展示绘图区，隐藏内部核验探针所在的代数区。
  api.setPerspective('G');
};
