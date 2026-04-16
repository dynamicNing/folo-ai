<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">AI 采集</h1>
      <span class="badge badge-draft">预留功能</span>
    </div>
    <div class="placeholder card">
      <div class="placeholder-icon">🤖</div>
      <h2>AI 采集模块</h2>
      <p class="text-muted">此功能尚在开发中，将支持从外部 AI 数据源自动采集内容并写入 MD 文件。</p>
      <div class="placeholder-features">
        <div class="feature-item">📡 RSS / API 数据源配置</div>
        <div class="feature-item">⏰ 定时自动采集</div>
        <div class="feature-item">✨ AI 摘要生成</div>
        <div class="feature-item">📂 自动分类入库</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
.page-title { font-size: 1.5rem; font-weight: 700; }
.placeholder {
  padding: 3rem 2rem;
  text-align: center;
  max-width: 480px;
}
.placeholder-icon { font-size: 3rem; margin-bottom: 1rem; }
.placeholder h2 { font-size: 1.2rem; margin-bottom: 0.5rem; }
.placeholder p { margin-bottom: 1.5rem; }
.placeholder-features {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-align: left;
  background: var(--bg);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
}
.feature-item { font-size: 0.9rem; color: var(--text-muted); }
</style>
