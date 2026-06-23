# P0.5 Gating —— MCP image-block 实测

判定整个 computer-use S3 方案命门的一步:**ACP CLI 后端(Claude Code / Codex / Gemini)到底会不会把
MCP 返回的 image content block 当"真图"喂给模型,还是只摘要成文字占位符。**

> 为什么是命门:见 [`docs/prds/local-computer-use/research-aioncore.md`](../../docs/prds/local-computer-use/research-aioncore.md)。
> aioncore 自身的模型输入路径**不带 image**(会被字符串化成 `[image: image/png]`),
> 截图能进模型**完全靠 CLI 子进程自己**把 MCP image 结果喂给自己的模型 —— 这行为在 aioncore 之外,只能实测。
> **本测试零 Rust、零后端改动。** 通过才值得投入 S3 的 Rust 改造。

## 这个 MCP server 是什么

最小 stdio MCP,两个工具:
- `echo` —— 对照组,确认 MCP 已连通、工具能被调用
- `get_test_image` —— 返回一张**带暗号的固定 PNG**(text + image 两个 content block)

暗号(只有模型真"看到"像素才能答出):

| 项 | 值 |
| --- | --- |
| 暗号码 | **CU-GATE-9F3K7** |
| 背景色 | **teal(青绿色)** |
| 圆的颜色 | **yellow(黄色)** |

## 怎么跑

### 1. 安装

```bash
cd experiments/computer-use-gating-mcp
npm install                 # 装 @modelcontextprotocol/sdk
npm run gen-image           # (可选)重新生成 test-image.png;仓库里已带一张
```

### 2. 挂到 CentaurAI 的 Settings → MCP

⚠️ **挂在"spawn CLI 的那台主机"上**(= CentaurAI 服务器/桌面端宿主),不是远端客户端 ——
本步只测 CLI 行为,不测客户端路由(外部 stdio MCP 由 CLI 在服务器主机 spawn)。

新增一个 **stdio** 类型的 MCP server:
- command: `node`
- args: `["<本目录绝对路径>/server.mjs"]`
  - 本机示例:`["/home/user/桌面/centaurai-aionui/experiments/computer-use-gating-mcp/server.mjs"]`
  - Windows 示例:`["C:\\...\\computer-use-gating-mcp\\server.mjs"]`(注意 `node` 需在 PATH)

### 3. 用 Claude Code 后端开一个会话,发这句

> 请调用 get_test_image 工具,然后**只**根据返回的图片告诉我三件事:图中的暗号码、背景颜色、圆的颜色。

(先可选发一句 `请调用 echo 工具回显 "ping"` 确认 MCP 通了。)

## 判定

| 结果 | 含义 | 对 S3 |
| ---- | ---- | ----- |
| ✅ 模型答出 **CU-GATE-9F3K7 / teal / yellow** | CLI 把 image block 当真图喂给了模型 | **S3 可行**,可投入 P2 Rust 改造 |
| ❌ 模型说"收到一张图但看不到内容" / 答错 / 给出 `[image: image/png]` 占位符 | CLI 只摘要文本,没把图喂给模型 | **S3 受阻**:改 vision 描述回退,或换支持 image 的后端;先别动 Rust |

跑完把结果记到 [`docs/prds/local-computer-use/research-aioncore.md`](../../docs/prds/local-computer-use/research-aioncore.md) §下一步 步骤 0。

## 已验证

- ✅ server 经 MCP SDK client 冒烟通过:`tools/list` 列出两工具;`get_test_image` 正确返回 `text` + `image(image/png)` content block(base64 ~30KB)。
- ✅ **gating 判定 PASS(Claude 后端,2026-06-23)**:`claude -p ... --mcp-config mcp-config.json --allowedTools mcp__gating__get_test_image`(headless,等价 aioncore spawn Claude 注入 MCP)。模型答出 **CU-GATE-9F3K7 / teal / yellow**,并主动指出"圆在右上角"(方位信息只能从像素读出)→ Claude Code CLI 把 MCP image 当真图喂给模型。**S3 命门解除。**
  - 复现:`mcp-config.json` 已留在本目录。
- ⏳ Codex / Gemini 后端未测(同机制,同法可测;各自 headless+MCP 授权与厂商 auth 不同)。
