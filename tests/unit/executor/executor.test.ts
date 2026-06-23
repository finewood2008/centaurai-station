import { describe, expect, it } from 'vitest';
import { Executor, parseKeyCombo } from '@process/executor/Executor';
import { ExecutorError } from '@process/executor/types';
import type { CapturedImage, MouseButton, Point, ScreenController, ScreenSize, ScrollDirection } from '@process/executor/types';

type Call = { fn: string; args: unknown[] };

/** Records every call and returns canned data — no display needed. */
class FakeScreenController implements ScreenController {
  readonly calls: Call[] = [];
  size: ScreenSize = { width: 1920, height: 1080 };
  failOn: string | null = null;

  private record(fn: string, ...args: unknown[]): void {
    if (this.failOn === fn) throw new Error(`boom:${fn}`);
    this.calls.push({ fn, args });
  }

  async screenSize(): Promise<ScreenSize> {
    this.record('screenSize');
    return this.size;
  }
  async capture(): Promise<CapturedImage> {
    this.record('capture');
    return { data: 'BASE64', mimeType: 'image/png', width: 1920, height: 1080 };
  }
  async cursorPosition(): Promise<Point> {
    this.record('cursorPosition');
    return { x: 42, y: 99 };
  }
  async moveMouse(x: number, y: number): Promise<void> {
    this.record('moveMouse', x, y);
  }
  async click(button: MouseButton, x: number, y: number): Promise<void> {
    this.record('click', button, x, y);
  }
  async doubleClick(x: number, y: number): Promise<void> {
    this.record('doubleClick', x, y);
  }
  async drag(from: Point, to: Point): Promise<void> {
    this.record('drag', from, to);
  }
  async typeText(text: string): Promise<void> {
    this.record('typeText', text);
  }
  async pressKeys(keys: string[]): Promise<void> {
    this.record('pressKeys', keys);
  }
  async scroll(x: number, y: number, direction: ScrollDirection, amount: number): Promise<void> {
    this.record('scroll', x, y, direction, amount);
  }
}

describe('parseKeyCombo', () => {
  it('splits, trims, lowercases, drops empties', () => {
    expect(parseKeyCombo('Ctrl+C')).toEqual(['ctrl', 'c']);
    expect(parseKeyCombo(' cmd + Shift + p ')).toEqual(['cmd', 'shift', 'p']);
    expect(parseKeyCombo('enter')).toEqual(['enter']);
    expect(parseKeyCombo('  +  ')).toEqual([]);
  });
});

describe('Executor', () => {
  const make = () => {
    const controller = new FakeScreenController();
    return { controller, executor: new Executor(controller) };
  };

  it('screenshot returns an image result', async () => {
    const { executor } = make();
    const result = await executor.execute({ type: 'screenshot' });
    expect(result).toEqual({ kind: 'image', image: { data: 'BASE64', mimeType: 'image/png', width: 1920, height: 1080 } });
  });

  it('cursor_position returns a position result', async () => {
    const { executor } = make();
    const result = await executor.execute({ type: 'cursor_position' });
    expect(result).toEqual({ kind: 'position', x: 42, y: 99 });
  });

  it('mouse_move dispatches within bounds', async () => {
    const { controller, executor } = make();
    const result = await executor.execute({ type: 'mouse_move', x: 100, y: 200 });
    expect(result).toEqual({ kind: 'ok' });
    expect(controller.calls).toContainEqual({ fn: 'moveMouse', args: [100, 200] });
  });

  it('maps left/right/middle click to the right button', async () => {
    const { controller, executor } = make();
    await executor.execute({ type: 'left_click', x: 1, y: 2 });
    await executor.execute({ type: 'right_click', x: 3, y: 4 });
    await executor.execute({ type: 'middle_click', x: 5, y: 6 });
    const clicks = controller.calls.filter((c) => c.fn === 'click').map((c) => c.args);
    expect(clicks).toEqual([
      ['left', 1, 2],
      ['right', 3, 4],
      ['middle', 5, 6],
    ]);
  });

  it('double_click dispatches', async () => {
    const { controller, executor } = make();
    await executor.execute({ type: 'double_click', x: 10, y: 20 });
    expect(controller.calls).toContainEqual({ fn: 'doubleClick', args: [10, 20] });
  });

  it('left_click_drag validates both endpoints and dispatches', async () => {
    const { controller, executor } = make();
    const from = { x: 1, y: 1 };
    const to = { x: 2, y: 2 };
    await executor.execute({ type: 'left_click_drag', from, to });
    expect(controller.calls).toContainEqual({ fn: 'drag', args: [from, to] });
  });

  it('type dispatches non-empty text and rejects empty', async () => {
    const { controller, executor } = make();
    await executor.execute({ type: 'type', text: 'hello' });
    expect(controller.calls).toContainEqual({ fn: 'typeText', args: ['hello'] });
    await expect(executor.execute({ type: 'type', text: '' })).rejects.toMatchObject({ code: 'empty_input' });
  });

  it('key parses combo and rejects empty', async () => {
    const { controller, executor } = make();
    await executor.execute({ type: 'key', keys: 'ctrl+a' });
    expect(controller.calls).toContainEqual({ fn: 'pressKeys', args: [['ctrl', 'a']] });
    await expect(executor.execute({ type: 'key', keys: '  ' })).rejects.toMatchObject({ code: 'empty_input' });
  });

  it('scroll dispatches and rejects non-positive amount', async () => {
    const { controller, executor } = make();
    await executor.execute({ type: 'scroll', x: 5, y: 5, direction: 'down', amount: 3 });
    expect(controller.calls).toContainEqual({ fn: 'scroll', args: [5, 5, 'down', 3] });
    await expect(executor.execute({ type: 'scroll', x: 5, y: 5, direction: 'down', amount: 0 })).rejects.toMatchObject({
      code: 'invalid_action',
    });
  });

  it('rejects out-of-bounds coordinates', async () => {
    const { executor } = make();
    await expect(executor.execute({ type: 'left_click', x: 5000, y: 10 })).rejects.toMatchObject({ code: 'out_of_bounds' });
    await expect(executor.execute({ type: 'mouse_move', x: -1, y: 10 })).rejects.toMatchObject({ code: 'out_of_bounds' });
    await expect(executor.execute({ type: 'mouse_move', x: 10, y: Number.NaN })).rejects.toMatchObject({
      code: 'out_of_bounds',
    });
  });

  it('wraps controller failures as controller_failure', async () => {
    const { controller, executor } = make();
    controller.failOn = 'capture';
    await expect(executor.execute({ type: 'screenshot' })).rejects.toMatchObject({ code: 'controller_failure' });
  });

  it('rejects unknown action types', async () => {
    const { executor } = make();
    // Cast through unknown to simulate a malformed action arriving over the wire.
    await expect(executor.execute({ type: 'frobnicate' } as unknown as Parameters<Executor['execute']>[0])).rejects.toBeInstanceOf(
      ExecutorError
    );
  });
});
