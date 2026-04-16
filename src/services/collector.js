/**
 * [预留] AI 采集模块
 *
 * 未来实现：从外部 AI 数据源（RSS、API、skill 等）抓取内容，
 * 解析后生成 MD 文件写入 content/ 目录对应分类文件夹。
 *
 * 预期接口：
 *   collect(config) → { saved: number, errors: string[] }
 *   getConfig() → config object
 *   saveConfig(config) → void
 */

async function collect(config) {
  throw new Error('AI 采集模块尚未实现');
}

async function getConfig() {
  throw new Error('AI 采集模块尚未实现');
}

async function saveConfig(config) {
  throw new Error('AI 采集模块尚未实现');
}

module.exports = { collect, getConfig, saveConfig };
