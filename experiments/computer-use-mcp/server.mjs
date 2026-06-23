// CentaurAI computer-use MCP server (EXPERIMENTAL) — REAL local control.
//
// A stdio MCP server that lets an AI agent SEE and CONTROL the machine it runs
// on: real screenshots, mouse, keyboard. Single-machine use: run this on the
// SAME machine as CentaurAI / Claude Code, and the model operates THIS computer.
//
// ⚠️ SAFETY: these tools really move your mouse, type, and click. Try it first
//    with a throwaway window focused (e.g. Notepad). Close it to revoke access.
//
// Run:  node server.mjs       (then add to CentaurAI Settings → MCP, or Claude Code)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { NutScreenController } from './NutScreenController.mjs';

const controller = new NutScreenController();

const coord = { type: 'integer', description: 'pixel coordinate (top-left origin)' };
const point = { type: 'object', properties: { x: coord, y: coord }, required: ['x', 'y'] };

const TOOLS = [
  { name: 'get_screen', description: 'Capture the current screen and return it as an image. Call before deciding where to click.', inputSchema: { type: 'object', properties: {} } },
  { name: 'cursor_position', description: 'Return the current mouse cursor position.', inputSchema: { type: 'object', properties: {} } },
  { name: 'mouse_move', description: 'Move the mouse to (x, y).', inputSchema: { type: 'object', properties: { x: coord, y: coord }, required: ['x', 'y'] } },
  { name: 'left_click', description: 'Left-click at (x, y).', inputSchema: { type: 'object', properties: { x: coord, y: coord }, required: ['x', 'y'] } },
  { name: 'right_click', description: 'Right-click at (x, y).', inputSchema: { type: 'object', properties: { x: coord, y: coord }, required: ['x', 'y'] } },
  { name: 'middle_click', description: 'Middle-click at (x, y).', inputSchema: { type: 'object', properties: { x: coord, y: coord }, required: ['x', 'y'] } },
  { name: 'double_click', description: 'Double-click at (x, y).', inputSchema: { type: 'object', properties: { x: coord, y: coord }, required: ['x', 'y'] } },
  { name: 'left_click_drag', description: 'Press at "from", drag to "to", release.', inputSchema: { type: 'object', properties: { from: point, to: point }, required: ['from', 'to'] } },
  { name: 'type_text', description: 'Type a string of text.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'key', description: 'Press a key combo, e.g. "ctrl+c" or "enter".', inputSchema: { type: 'object', properties: { keys: { type: 'string' } }, required: ['keys'] } },
  { name: 'scroll', description: 'Scroll at (x, y).', inputSchema: { type: 'object', properties: { x: coord, y: coord, direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, amount: { type: 'integer' } }, required: ['x', 'y', 'direction', 'amount'] } },
];

function parseKeyCombo(combo) {
  return String(combo).split('+').map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
}

async function assertInBounds(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`coordinates must be numbers, got (${x}, ${y})`);
  const { width, height } = await controller.screenSize();
  if (x < 0 || y < 0 || x >= width || y >= height) throw new Error(`(${x}, ${y}) is outside screen ${width}x${height}`);
}

const ok = (text) => ({ content: [{ type: 'text', text }] });

async function dispatch(name, args = {}) {
  switch (name) {
    case 'get_screen': {
      const img = await controller.capture();
      return { content: [{ type: 'text', text: 'Screen captured.' }, { type: 'image', data: img.data, mimeType: img.mimeType }] };
    }
    case 'cursor_position': {
      const p = await controller.cursorPosition();
      return ok(`cursor at (${p.x}, ${p.y})`);
    }
    case 'mouse_move':
      await assertInBounds(args.x, args.y);
      await controller.moveMouse(args.x, args.y);
      return ok(`moved to (${args.x}, ${args.y})`);
    case 'left_click':
    case 'right_click':
    case 'middle_click': {
      await assertInBounds(args.x, args.y);
      const button = name === 'left_click' ? 'left' : name === 'right_click' ? 'right' : 'middle';
      await controller.click(button, args.x, args.y);
      return ok(`${button} click at (${args.x}, ${args.y})`);
    }
    case 'double_click':
      await assertInBounds(args.x, args.y);
      await controller.doubleClick(args.x, args.y);
      return ok(`double click at (${args.x}, ${args.y})`);
    case 'left_click_drag':
      await assertInBounds(args.from?.x, args.from?.y);
      await assertInBounds(args.to?.x, args.to?.y);
      await controller.drag(args.from, args.to);
      return ok(`dragged (${args.from.x},${args.from.y}) → (${args.to.x},${args.to.y})`);
    case 'type_text':
      if (!args.text) throw new Error('type_text requires non-empty text');
      await controller.typeText(args.text);
      return ok(`typed ${args.text.length} chars`);
    case 'key': {
      const keys = parseKeyCombo(args.keys);
      if (keys.length === 0) throw new Error('key requires at least one key');
      await controller.pressKeys(keys);
      return ok(`pressed ${keys.join('+')}`);
    }
    case 'scroll':
      await assertInBounds(args.x, args.y);
      if (!Number.isFinite(args.amount) || args.amount <= 0) throw new Error('scroll amount must be positive');
      await controller.scroll(args.x, args.y, args.direction, args.amount);
      return ok(`scrolled ${args.direction} ${args.amount} at (${args.x}, ${args.y})`);
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

const server = new Server({ name: 'centaurai-computer-use', version: '0.1.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    return await dispatch(req.params.name, req.params.arguments ?? {});
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `computer-use error: ${e?.message ?? String(e)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[centaurai-computer-use] ready: ${TOOLS.length} tools (REAL local control)\n`);
