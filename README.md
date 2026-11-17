# Make Vote

一站式设计和管理线下投票。

[👉 立即使用](https://make-vote.by-ts.top)

## 功能

- 创建投票
  - 自定义布局，支持富文本编辑、Markdown 转换及 HTTPS 图片
  - 导出可打印的文件
  - 选票序列号、唯一编号或二维码
- 结果统计（WIP）
  - 多种计票方式：单选制、Meek STV
  - 编号验证、重复投票检测
  - 选票总表、计票过程和结果导出

## 本地开发

使用 Bun 安装依赖、运行 Nuxt。Cloudflare CLI 需要 Node.js 22.18 或更新版本。

```sh
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run lint
bun test
bun run schema:generate
bun run build
```

浏览器测试：先启动开发服务，再运行 `bunx playwright install chromium` 和 `bun run test:e2e`。可用 `PLAYWRIGHT_BASE_URL` 指定服务地址，或用 `PLAYWRIGHT_CHANNEL=msedge` 测试已安装的 Edge。
