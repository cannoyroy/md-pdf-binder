import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

async function getAvailablePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return port;
}

const port = await getAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`服务提前退出：\n${serverOutput}`);
    }
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return response;
    } catch {
      // 服务仍在启动。
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`等待服务启动超时：\n${serverOutput}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  server.kill();
  await Promise.race([
    once(server, 'exit'),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

const files = [
  {
    name: 'intro.md',
    content: '---\nauthor: Test Author\n---\n# Introduction\n\n```js\nconst ready = true;\n```',
  },
  {
    name: 'results.md',
    content: '# Results\n\n| Item | Value |\n| --- | --- |\n| PDF | Ready |',
  },
];

try {
  const homeResponse = await waitForServer();
  assert.match(await homeResponse.text(), /md-pdf-binder/);

  const invalidResponse = await fetch(`${baseUrl}/api/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [] }),
  });
  assert.equal(invalidResponse.status, 400);

  const requestBody = JSON.stringify({ files, includeTOC: true });
  const mergeResponse = await fetch(`${baseUrl}/api/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
  });
  assert.equal(mergeResponse.status, 200);
  const html = await mergeResponse.text();
  assert.match(html, /class="toc-page"/);
  assert.match(html, /Test Author/);
  assert.match(html, /class="hljs-keyword"/);
  assert.ok(html.indexOf('Introduction') < html.indexOf('Results'));

  const pdfResponse = await fetch(`${baseUrl}/api/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
    signal: AbortSignal.timeout(60_000),
  });
  if (!pdfResponse.ok) {
    const responseBody = await pdfResponse.text();
    throw new Error(`PDF 导出失败 (${pdfResponse.status})：${responseBody}\n${serverOutput}`);
  }
  assert.match(pdfResponse.headers.get('content-type') ?? '', /^application\/pdf/);
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1_000);

  console.log('Smoke test passed: home, merge, highlighting, frontmatter, TOC, and PDF export.');
} finally {
  await stopServer();
}
