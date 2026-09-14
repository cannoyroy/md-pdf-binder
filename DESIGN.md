# md-pdf-binder 设计文档

## 项目目标

一个本地运行的 Web 工具：将多个 Markdown 文件拖入浏览器 → 自由调整顺序 → 实时预览合并效果 → 一键导出为排版精良的 PDF。适用于论文拼接、报告合集、文档归档等场景。

## 核心功能

| 功能 | 说明 |
|------|------|
| 文件上传 | 拖拽或点击选择多个 `.md` 文件 |
| 文件列表 | 显示已上传文件，支持拖拽排序 + 上下箭头微调 |
| Markdown 渲染 | 实时预览合并后的渲染效果，支持 GFM 表格、代码高亮 |
| PDF 导出 | 合并为一份 PDF，基于 Puppeteer Chromium 打印 |

## 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 后端 | Express.js | 轻量、无多余依赖 |
| 前端构建 | Vite | 开发热更新快，配置极简 |
| 前端逻辑 | 原生 JS + SortableJS | 无框架依赖，拖拽排序开箱即用 |
| Markdown | marked + highlight.js | GFM 支持完善，代码高亮 |
| PDF | Puppeteer | CSS 打印保真度最高，支持 @page 控制 |

## 架构

```
浏览器（前端）                          Node.js（后端）
┌─────────────────────┐          ┌─────────────────────────┐
│  文件选择/拖入        │  POST   │  Express 接收文件        │
│  ↓                  │ ──────► │  ↓                      │
│  文件列表（可拖拽排序）│         │  临时目录写入             │
│  ↓                  │         │  ↓                      │
│  调 /api/merge      │ ──────► │  按顺序拼接 Markdown     │
│  ↓                  │  返回HTML │  ↓                      │
│  实时预览            │ ◄────── │  渲染为 HTML 返回         │
│  ↓                  │         │                         │
│  点击「导出PDF」     │ ──────► │  Puppeteer 打印 HTML→PDF │
│  ↓                  │  返回PDF │  ↓                      │
│  浏览器下载 PDF      │ ◄────── │  返回 PDF 文件           │
└─────────────────────┘          └─────────────────────────┘
```

## 目录结构

```
md-pdf-binder/
├── DESIGN.md              # 本文件
├── package.json
├── server.js              # Express 后端入口
├── public/                # 前端静态资源
│   ├── index.html
│   ├── style.css
│   └── app.js
└── temp/                  # 临时文件（运行时自动生成，.gitignore）
```

## 实现步骤

**Step A — 项目脚手架**
- 创建 `package.json`，安装依赖（express、puppeteer、marked、highlight.js、cors）
- 创建目录结构 + `.gitignore`

**Step B — 前端界面**
- `index.html`：文件区域、排序列表、预览区、导出按钮
- `style.css`：响应式布局，左右分栏（列表 + 预览）
- `app.js`：文件读取、SortableJS 排序、调 API 渲染/导出

**Step C — 后端 API**
- `POST /api/files` — 接收上传文件，返回文件 ID 列表
- `POST /api/merge` — 接收排序后的文件 ID 列表，拼接后返回渲染 HTML
- `POST /api/export-pdf` — 接收排序列表，返回 PDF 文件流

**Step D — 集成测试 + 打磨**
- 端到端测试：上传 → 排序 → 预览 → 导出
- 样式微调：PDF 分页符、页眉页脚、代码块样式

## 待确认项

| 项目 | 默认值 | 说明 |
|------|--------|------|
| PDF 模式 | 合并为一份 | 也可支持「每文件单独导出」，后续扩展 |
| 页眉 | 当前文件/章节名 | 通过 CSS `@page` 实现 |
| 目录页 | 不需要 | 若需自动生成目录，可用 marked 解析后提取标题 |
