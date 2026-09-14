import express from 'express';
import cors from 'cors';
import { Marked } from 'marked';
import hljs from 'highlight.js';
import puppeteer from 'puppeteer';
import { load as yamlLoad } from 'js-yaml';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// ---- marked 配置 ----
const marked = new Marked({
  gfm: true,
  breaks: true,
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

const CSS_STYLES = `
  @page { margin: 2cm; }
  body {
    font-family: "Noto Serif SC", "Source Han Serif SC", Georgia, serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #1e293b;
  }
  h1 { font-size: 22pt; margin-top: 32pt; page-break-after: avoid; }
  h2 { font-size: 16pt; margin-top: 24pt; page-break-after: avoid; }
  h3 { font-size: 13pt; margin-top: 18pt; page-break-after: avoid; }
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 12pt;
    border-radius: 6px;
    font-size: 9pt;
    line-height: 1.5;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  code {
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }
  :not(pre) > code {
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.9em;
  }
  blockquote {
    border-left: 3pt solid #2563eb;
    padding: 6pt 12pt;
    margin: 10pt 0;
    color: #334155;
    background: #f8fafc;
  }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  th, td { border: 1pt solid #ddd; padding: 6pt 10pt; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  img { max-width: 100%; }
  .file-separator {
    page-break-before: always;
    border-top: 2pt solid #e2e8f0;
    padding-top: 12pt;
    margin-top: 24pt;
  }
  .toc-page { page-break-after: always; padding: 2cm 0; }
  .toc-title { font-size: 22pt; margin-bottom: 24pt; }
  .toc-list { list-style: none; padding: 0; counter-reset: toc-counter; }
  .toc-list li {
    counter-increment: toc-counter;
    padding: 8pt 0;
    border-bottom: 1pt solid #ddd;
    font-size: 12pt;
  }
  .toc-list li::before {
    content: counter(toc-counter) ". ";
    color: #94a3b8;
  }
  .toc-list a { color: #2563eb; text-decoration: none; }
  .meta-card {
    border: 1pt solid #e2e8f0;
    border-radius: 6pt;
    padding: 10pt 14pt;
    margin-bottom: 16pt;
    background: #f8fafc;
    font-size: 10pt;
  }
  .meta-row { display: flex; gap: 8pt; padding: 3pt 0; }
  .meta-key { font-weight: 600; color: #64748b; min-width: 100pt; flex-shrink: 0; }
  .meta-val { color: #1e293b; }
`;

// ---- 辅助：解析 YAML frontmatter ----
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { meta: null, body: content };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { meta: null, body: content };
  const yamlStr = content.slice(3, end).trim();
  const body = content.slice(end + 4).trimStart();
  try {
    const meta = yamlLoad(yamlStr);
    return { meta: meta && typeof meta === 'object' ? meta : null, body };
  } catch {
    return { meta: null, body: content };
  }
}

// ---- 辅助：渲染元信息卡片 ----
function renderMetaCard(meta) {
  const rows = Object.entries(meta)
    .map(([key, val]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `<div class="meta-row"><span class="meta-key">${label}</span><span class="meta-val">${String(val)}</span></div>`;
    })
    .join('\n');
  return `<div class="meta-card">${rows}</div>`;
}

// ---- 辅助：生成目录 ----
function buildTOC(files) {
  const items = files
    .map((f, i) => {
      const baseName = f.name.replace(/\.md$|\.markdown$/i, '');
      return `<li><a href="#section-${i}">${baseName}</a></li>`;
    })
    .join('\n');
  return `
    <div class="toc-page">
      <h1 class="toc-title">目录</h1>
      <ol class="toc-list">${items}</ol>
    </div>
    <div class="file-separator"></div>
  `;
}

// ---- 辅助：拼接并渲染 ----
function renderMerged(files, includeTOC = false) {
  const tocHtml = includeTOC ? buildTOC(files) : '';
  const bodyHtml = files
    .map((f, i) => {
      const { meta, body } = parseFrontmatter(f.content);
      const metaHtml = meta ? renderMetaCard(meta) : '';
      const mdHtml = marked.parse(body);
      const content = metaHtml + mdHtml;
      const anchored = `<a id="section-${i}"></a>${content}`;
      if (i === 0) return anchored;
      return `<div class="file-separator">${anchored}</div>`;
    })
    .join('\n');
  return tocHtml + bodyHtml;
}

// ---- API: 合并预览（返回 HTML）----
app.post('/api/merge', (req, res) => {
  const { files, includeTOC } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).send('没有文件');
  }
  const html = renderMerged(files, includeTOC);
  res.type('html').send(html);
});

// ---- API: 导出 PDF ----
app.post('/api/export-pdf', async (req, res) => {
  const { files, includeTOC } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).send('没有文件');
  }

  const bodyHtml = renderMerged(files, includeTOC);
  const fullHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>${CSS_STYLES}</style>
</head><body>${bodyHtml}</body></html>`;

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdfData = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
    });
    await browser.close();

    const pdfBuffer = Buffer.from(pdfData);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="merged-output.pdf"',
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF 生成失败:', err);
    res.status(500).send('PDF 生成失败');
  }
});

// ---- 启动 ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`md-pdf-binder 运行中：http://localhost:${PORT}`);
});
