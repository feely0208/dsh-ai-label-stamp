/**
 * dsh-ai-label-stamp —— AI 标识写入内核（GB 45438-2025 附录 E）
 * 支持：docx（重写 core.xml keywords）/ png（插入 AIGC tEXt 块）/ txt·md（文首追加标识行）。
 * 打完的文件用 dsh-ai-label-verify 验标——闭环。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';

export const META_KEYS = {
  label: '生成合成标签要素',
  provider: '生成合成服务提供者要素',
  serviceId: '服务编号要素',
  contentId: '内容编号要素',
};

/** 构造五要素 JSON（附加信息留空可选） */
export function aigcJson({ provider, serviceId, contentId }) {
  return JSON.stringify({ Label: 'AIGC', Provider: provider, ServiceId: serviceId, ContentId: contentId });
}

/** PNG：在 IEND 前插入 AIGC tEXt 块（重建 chunk 流） */
export function stampPng(buf, json) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('不是合法 PNG');
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(body)); return Buffer.concat([l, body, c]); };
  const text = Buffer.concat([Buffer.from('AIGC'), Buffer.from([0]), Buffer.from(json, 'utf-8')]);
  const parts = [SIG];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const seg = buf.subarray(off, off + 12 + len);
    if (type === 'IEND') { parts.push(chunk('tEXt', text)); }
    parts.push(seg);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

/** docx：python3 标准库重写 —— 把五要素写进 docProps/core.xml 的 keywords */
function stampDocx(file, json, outPath) {
  const py = `import zipfile, sys, re
src, dst, kw = sys.argv[1], sys.argv[2], sys.argv[3]
zin = zipfile.ZipFile(src)
items = []
for n in zin.namelist():
    data = zin.read(n)
    if n == 'docProps/core.xml':
        x = data.decode('utf-8')
        if '<cp:keywords>' in x:
            x = re.sub(r'<cp:keywords>[^<]*</cp:keywords>', '<cp:keywords>' + kw + '</cp:keywords>', x)
        else:
            x = x.replace('</cp:coreProperties>', '<cp:keywords>' + kw + '</cp:keywords></cp:coreProperties>')
        data = x.encode('utf-8')
    items.append((n, data))
zout = zipfile.ZipFile(dst, 'w')
for n, data in items:
    zout.writestr(n, data)
zout.close()
print('ok')`;
  const r = spawnSync('python3', ['-c', py, file, outPath, json], { encoding: 'utf-8', timeout: 60_000 });
  if (r.status !== 0) throw new Error('python3 重写 docx 失败：' + (r.stderr || '').slice(0, 200));
}

/** 对外：打标单个文件 → 输出路径 */
export function stampFile(file, { provider = 'DeepSeek', serviceId = 'S-001', contentId = '', outDir } = {}) {
  const ext = extname(file).toLowerCase();
  const name = basename(file);
  const json = aigcJson({ provider, serviceId, contentId: contentId || `${serviceId}-${Buffer.from(name).toString('base64url').slice(0, 8)}` });
  const out = outDir ? join(outDir, name) : file;
  if (outDir) mkdirSync(outDir, { recursive: true });
  if (ext === '.png') {
    writeFileSync(out, stampPng(readFileSync(file), json));
  } else if (ext === '.docx') {
    stampDocx(file, json, out);
  } else if (ext === '.txt' || ext === '.md') {
    const body = readFileSync(file, 'utf-8');
    const line = `\n【AIGC】${json}\n`;
    writeFileSync(out, body.endsWith('\n') ? body + line : body + '\n' + line, 'utf-8');
  } else {
    throw new Error(`暂不支持 ${ext}（支持 docx/png/txt/md；jpg/pdf/wav 打标需按对应容器规范写入，见 README 边界）`);
  }
  return { out, json };
}

export { readFileSync, writeFileSync, mkdirSync, join, basename };

// ── DSH 插件接入（方案 A 薄壳：注册 skill 与 CLI 入口；业务逻辑仍在 lib/bin）──
import { createPlugin, pkgRootFrom } from '@deepwhale-cn/dsh-guard-core/plugin';

export const { name, inject, apply } = createPlugin({
  name: 'ai-label-stamp',
  pkgRoot: pkgRootFrom(import.meta.url),
  skillFile: 'skill/ai-label-stamp.md',
  binFile: 'bin/cli.mjs',
  description: "给 docx/png/txt 写入 GB 45438 隐式标识元数据（AIGC 关键词 + 五要素），是 dsh-ai-label-verify 验标的执行端",
  whenToUse: "AI 生成的 docx/png/txt 对外分发前写入 GB 45438 隐式标识。用户会说：帮我给这批文件打上标识。",
});
