#!/usr/bin/env node
/**
 * dsh-ai-label-stamp —— AI 标识写入（GB 45438-2025 附录 E）
 * 用法：
 *   dsh-ai-label-stamp --dir <目录> --provider DeepSeek --service-id S-001 [--content-prefix C-2026] [--out 目录] [--json]
 * 支持 docx / png / txt / md（jpg/pdf/wav 打标需对应容器规范，见 README）。
 * 默认把打标副本写到 --out（不动原文件）；--in-place 才原地覆盖。
 * 打完用 dsh-ai-label-verify 验标闭环。
 */
import { resolve, join } from 'node:path';
import { stampFile } from '../lib/index.js';

const args = process.argv.slice(2);
const has = (k) => args.includes('--' + k);
const val = (k, d = '') => {
  const i = args.indexOf('--' + k);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

if (has('help') || !has('dir')) {
  console.log(`dsh-ai-label-stamp —— AI 标识写入（GB 45438-2025 附录 E）

用法：
  dsh-ai-label-stamp --dir <目录> [--provider DeepSeek] [--service-id S-001] [--content-prefix C-2026]
                     [--out 目录] [--in-place] [--json]
支持 docx / png / txt / md。默认写副本到 --out（不指定则必须 --in-place）。
打完用 dsh-ai-label-verify --dir 验标闭环。`);
  process.exit(0);
}

if (!has('out') && !has('in-place')) {
  console.error('❌ 需要指定 --out 目录（写副本）或 --in-place（原地覆盖）。默认不动原文件。');
  process.exit(2);
}

const dir = resolve(val('dir'));
const outDir = has('out') ? resolve(val('out')) : null;
const provider = val('provider', 'DeepSeek');
const serviceId = val('service-id', 'S-001');
const prefix = val('content-prefix', 'C-2026');

const results = [];
let ok = 0, failed = 0;
const { readdirSync, statSync } = await import('node:fs');
const SUPPORTED = ['.docx', '.png', '.txt', '.md'];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const full = join(d, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    const ext = (e.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    if (!SUPPORTED.includes(ext)) continue;
    try {
      const contentId = `${prefix}-${Buffer.from(e.name).toString('base64url').slice(0, 8)}`;
      const r = stampFile(full, { provider, serviceId, contentId, outDir: has('in-place') ? null : outDir });
      ok += 1;
      results.push({ file: e.name, ok: true, out: r.out, contentId });
      if (!has('json')) console.log(`✅ ${e.name} → ${r.out}`);
    } catch (err) {
      failed += 1;
      results.push({ file: e.name, ok: false, error: String(err.message || err) });
      if (!has('json')) console.log(`❌ ${e.name}  ${String(err.message || err).slice(0, 120)}`);
    }
  }
})(dir);
if (!has('json')) console.log(`\n打标完成：成功 ${ok} · 失败 ${failed}${outDir ? ` · 输出目录 ${outDir}` : '（原地覆盖）'}`);
if (has('json')) process.stdout.write(JSON.stringify({ ok, failed, results }, null, 2, null, 2) + '\n', () => process.exit(failed ? 1 : 0));
