const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

// 密码从环境变量读取，启动前需设置 ADMIN_PASSWORD_HASH
// 生成方式: node -e "const b=require('bcryptjs');console.log(b.hashSync('你的密码',10))"
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请输入密码' });

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ error: '服务端未配置管理员密码' });

  const ok = await bcrypt.compare(password, hash);
  if (!ok) return res.status(401).json({ error: '密码错误' });

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;
