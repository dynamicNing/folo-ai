const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全头
app.use(helmet({
  contentSecurityPolicy: false, // 静态站关闭 CSP
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors());

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 兜底
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Folo-AI 服务运行中 → http://0.0.0.0:${PORT}`);
});
