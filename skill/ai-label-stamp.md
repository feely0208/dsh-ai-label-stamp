# AI 标识写入（dsh-ai-label-stamp）

**什么时候用**：AI 生成的 docx/png/txt 对外分发前，把 GB 45438 隐式标识写进文件元数据。与 dsh-ai-label-verify（验标）成闭环。
用户会说：「帮我给这批 AI 生成的文件打上标识」「写进元数据」。

## 怎么用

```bash
<cli 路径> --dir <目录> --provider DeepSeek --service-id S-001 --out ./已打标   # 写副本
<cli 路径> --dir <目录> --in-place                                            # 原地覆盖
dsh-ai-label-verify --dir ./已打标                                            # 验标闭环
```

写入内容：元数据 AIGC 关键词 + 五要素 JSON（Label/Provider/ServiceId/ContentId，内容编号按文件名自动生成）。

## 边界

- 支持 docx（重写 core.xml keywords）/ png（插入 AIGC tEXt 块）/ txt·md（文首追加标识行）
- jpg/pdf/wav 打标需按对应容器规范写入，暂不支持
- 默认写副本不动原文件；--in-place 才原地覆盖
