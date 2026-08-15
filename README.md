# TG 精准计算机器人（Cloudflare Workers 版）

这版与“开心一刻”机器人采用相同思路：GitHub 保存代码，Cloudflare Workers 运行，Telegram Webhook 接收消息，D1 保存历史。不需要在电脑安装 Python，也不需要一直开着 PowerShell。

## 文件用途

- `src/index.js`：完整机器人代码
- `schema.sql`：历史记录数据库
- `wrangler.toml`：Cloudflare 配置
- `package.json`：部署配置

## 部署所需信息

Cloudflare 中需要配置秘密变量 `TELEGRAM_BOT_TOKEN`，值为 BotFather 新发的 Token。不要把 Token 写入 GitHub 文件。

创建 D1 数据库 `tg-calculator-history`，执行 `schema.sql`，并把数据库 ID 填入 `wrangler.toml`。部署成功后，把 Worker 地址加上 `/telegram-webhook` 设置为 Telegram Webhook。

Webhook 格式：

```text
https://api.telegram.org/bot你的Token/setWebhook?url=https://你的Worker地址/telegram-webhook
```

不要截图或公开含 Token 的完整链接。
