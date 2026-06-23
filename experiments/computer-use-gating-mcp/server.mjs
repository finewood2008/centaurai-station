// P0.5 Gating —— 最小 stdio MCP server。
// 目的:判定 ACP CLI 后端(Claude Code / Codex / Gemini)是否把 MCP 返回的
//       image content block 当作"真图"喂给模型,还是只摘要成文字占位符。
// 这一步 gating 整个 computer-use S3 方案(见 docs/prds/local-computer-use/research-aioncore.md)。
//
// 两个工具:
//   echo            —— 对照组,确认 MCP 已连通、工具可被调用
//   get_test_image  —— 返回一张带暗号的固定 PNG(image content block)
//
// 判定:让模型「调用 get_test_image,然后说出图里的暗号、背景色、圆的颜色」。
//   ✓ 模型答出 CU-GATE-9F3K7 / teal / yellow  → image block 行为成立,S3 可行
//   ✗ 模型说「收到图但看不到内容」/给出占位符  → 后端只摘要文本,S3 需 vision 回退或换后端
//
// 运行(stdio):  node server.mjs
// 挂载:Settings → MCP → 新增 stdio server,command=node,args=[<本文件绝对路径>]

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGE_B64 = readFileSync(join(__dirname, 'test-image.png')).toString('base64');

const server = new Server(
  { name: 'computer-use-gating', version: '0.0.1' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'echo',
      description: '对照组:原样返回传入的 text,确认 MCP 已连通。',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', description: '要回显的文本' } },
        required: ['text'],
      },
    },
    {
      name: 'get_test_image',
      description:
        'gating 测试:返回一张固定的测试图片(PNG)。图中含一个暗号码、一个背景色和一个圆。调用后请如实描述你在图中看到的暗号码、背景颜色、圆的颜色。',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === 'echo') {
    return { content: [{ type: 'text', text: String(args?.text ?? '') }] };
  }

  if (name === 'get_test_image') {
    return {
      content: [
        { type: 'text', text: '这是测试图片,请描述图中的暗号码、背景色与圆的颜色。' },
        { type: 'image', data: IMAGE_B64, mimeType: 'image/png' },
      ],
    };
  }

  return {
    isError: true,
    content: [{ type: 'text', text: `unknown tool: ${name}` }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
// stdio 模式下不要写 stdout(会污染协议);诊断信息走 stderr。
process.stderr.write('[gating-mcp] ready: tools = echo, get_test_image\n');
