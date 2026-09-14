# md-pdf-binder 设计文档

## 项目目标

一个本地运行的 Web 工具：在浏览器中读取多个 Markdown 文件，自由调整顺序，预览合并结果，并导出为排版统一的 PDF。适用于报告合并、论文附录和文档归档等场景。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 文件选择 | 拖放或批量选择 `.md`、`.markdown` 和 `.txt` 文件 |
| 文件排序 | 拖拽排序，也可用上下按钮微调和移除文件 |
| Markdown 渲染 | 支持 GFM 表格、代码高亮和 YAML frontmatter |
| 合并预览 | 按当前顺序合并文件，可选择生成文件级目录 |
| PDF 导出 | 调用系统 Edge、Chrome 或 Chromium 生成 A4 PDF |

## 技术选型

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 服务端 | Express.js | 提供静态页面、合并和 PDF 接口 |
| 浏览器端 | 原生 JavaScript + SortableJS | 无构建步骤，直接提供静态资源 |
| Markdown | marked + marked-highlight + highlight.js | 渲染 GFM 并进行代码语法高亮 |
| 元信息 | js-yaml | 解析文件开头的 YAML frontmatter |
| PDF | puppeteer-core + 系统浏览器 | 避免为项目额外下载专用 Chromium |

## 数据流

```text
浏览器读取本地文件
        │
        ├── 调整顺序、移除文件
        │
        ├── POST /api/merge ──────> 服务端渲染 HTML ──────> 浏览器预览
        │
        └── POST /api/export-pdf ─> 系统浏览器打印 HTML ──> 下载 PDF
```

文件内容由浏览器通过 JSON 请求发送给本机服务，仅在请求期间保存在内存中。应用不创建上传目录，也不把源文件写入磁盘。

## 服务端接口

两个接口使用相同请求结构：

```json
{
  "files": [
    { "name": "chapter.md", "content": "# Chapter" }
  ],
  "includeTOC": true
}
```

- `POST /api/merge`：返回合并并渲染后的 HTML。
- `POST /api/export-pdf`：返回 `application/pdf` 文件流。
- 文件数组为空时返回 HTTP 400。

## 运行约束

- Node.js 版本不低于 22.12。
- 默认监听 `127.0.0.1:3000`，可通过 `HOST` 和 `PORT` 修改。
- 自动查找常见位置中的 Edge、Chrome 或 Chromium；非常规安装可使用 `BROWSER_PATH`。
- 应用按本地可信文档设计。若部署为公开服务，需要增加身份验证、内容清理、请求限流和浏览器隔离。

## 验证

`npm test` 会启动临时服务，验证首页、输入校验、文件顺序、目录、frontmatter、代码高亮和真实 PDF 输出。GitHub Actions 在推送和 Pull Request 时运行相同测试及生产依赖审计。
