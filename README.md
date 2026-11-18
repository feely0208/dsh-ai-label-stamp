# @deepwhale-cn/dsh-ai-label-stamp

AI 标识写入：给 docx/png/txt/md 写入 GB 45438-2025 附录 E 隐式标识（AIGC 关键词 + 五要素 JSON）。**执行端**——打完用 dsh-ai-label-verify 验标闭环。

```bash
npx @deepwhale-cn/dsh-ai-label-stamp --dir <目录> --out ./已打标
npx @deepwhale-cn/dsh-ai-label-verify --dir ./已打标   # 验标
```

支持 docx/png/txt/md；默认写副本不动原文件。
