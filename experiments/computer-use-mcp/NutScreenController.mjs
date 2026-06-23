// Real nut.js backend: drives the LOCAL machine's screen, mouse and keyboard.
// Implements the same ScreenController shape as
// packages/desktop/src/process/executor/types.ts.
//
// ⚠️ This controls the REAL machine it runs on.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Button, Key, keyboard, mouse, Point, screen, straightTo } from '@nut-tree-fork/nut-js';

const BUTTONS = { left: Button.LEFT, right: Button.RIGHT, middle: Button.MIDDLE };

// Named keys → nut.js Key. Letters (a-z), digits (0-9) and F1-F12 handled below.
const NAMED_KEYS = {
  ctrl: Key.LeftControl, control: Key.LeftControl,
  alt: Key.LeftAlt, option: Key.LeftAlt,
  shift: Key.LeftShift,
  cmd: Key.LeftSuper, meta: Key.LeftSuper, super: Key.LeftSuper, win: Key.LeftSuper,
  enter: Key.Enter, return: Key.Enter,
  tab: Key.Tab, esc: Key.Escape, escape: Key.Escape,
  space: Key.Space, backspace: Key.Backspace, delete: Key.Delete, del: Key.Delete,
  up: Key.Up, down: Key.Down, left: Key.Left, right: Key.Right,
  home: Key.Home, end: Key.End, pageup: Key.PageUp, pagedown: Key.PageDown,
};

function toKey(name) {
  if (name in NAMED_KEYS) return NAMED_KEYS[name];
  if (/^[a-z]$/.test(name)) return Key[name.toUpperCase()];
  if (/^[0-9]$/.test(name)) return Key[`Num${name}`];
  if (/^f([1-9]|1[0-2])$/.test(name)) return Key[name.toUpperCase()];
  throw new Error(`unsupported key: ${name}`);
}

export class NutScreenController {
  async screenSize() {
    return { width: await screen.width(), height: await screen.height() };
  }

  async capture() {
    const width = await screen.width();
    const height = await screen.height();
    const dir = mkdtempSync(join(tmpdir(), 'cu-shot-'));
    try {
      await screen.capture('screen', undefined, dir, 'screen');
      const data = readFileSync(join(dir, 'screen.png')).toString('base64');
      return { data, mimeType: 'image/png', width, height };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async cursorPosition() {
    const p = await mouse.getPosition();
    return { x: p.x, y: p.y };
  }

  async moveMouse(x, y) {
    await mouse.setPosition(new Point(x, y));
  }

  async click(button, x, y) {
    await mouse.setPosition(new Point(x, y));
    await mouse.click(BUTTONS[button]);
  }

  async doubleClick(x, y) {
    await mouse.setPosition(new Point(x, y));
    await mouse.doubleClick(Button.LEFT);
  }

  async drag(from, to) {
    await mouse.setPosition(new Point(from.x, from.y));
    await mouse.pressButton(Button.LEFT);
    await mouse.move(straightTo(new Point(to.x, to.y)));
    await mouse.releaseButton(Button.LEFT);
  }

  async typeText(text) {
    await keyboard.type(text);
  }

  async pressKeys(keys) {
    await keyboard.type(...keys.map(toKey));
  }

  async scroll(x, y, direction, amount) {
    await mouse.setPosition(new Point(x, y));
    if (direction === 'down') await mouse.scrollDown(amount);
    else if (direction === 'up') await mouse.scrollUp(amount);
    else if (direction === 'left') await mouse.scrollLeft(amount);
    else await mouse.scrollRight(amount);
  }
}

export { toKey };
