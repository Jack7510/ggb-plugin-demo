/**
 * @fileoverview 统一工具错误类型，使 CLI 能区分稳定错误码、可读原因与诊断目录。
 */

/** 保留稳定错误码与诊断路径，防止错误结果被包装成成功交付。 */
export class ToolError extends Error {
  /**
   * @param code 供调用方稳定分支判断，不能依赖可读 message 的具体措辞。
   * @param message 面向使用者的失败原因，不包含伪造的成功结果。
   * @param diagnostics 已保存的诊断目录；参数预检失败时可能尚未创建。
   */
  constructor(
    public code: string,
    message: string,
    public diagnostics?: string,
  ) {
    super(message);
  }
}
