/**
 * Computer-use action executor (EXPERIMENTAL).
 *
 * Validates an {@link ExecutorAction} and dispatches it to a
 * {@link ScreenController}, returning an {@link ExecutorResult}. All OS access
 * goes through the injected controller, so this class is fully unit-testable
 * with a fake controller (no display required).
 */

import type { ExecutorAction, ExecutorResult, Point, ScreenController, ScreenSize } from './types';
import { ExecutorError } from './types';

/** Parse a key combo string like "ctrl+c" into normalized parts. */
export function parseKeyCombo(combo: string): string[] {
  return combo
    .split('+')
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

export class Executor {
  private readonly controller: ScreenController;

  constructor(controller: ScreenController) {
    this.controller = controller;
  }

  async execute(action: ExecutorAction): Promise<ExecutorResult> {
    switch (action.type) {
      case 'screenshot': {
        const image = await this.guard(() => this.controller.capture());
        return { kind: 'image', image };
      }
      case 'cursor_position': {
        const point = await this.guard(() => this.controller.cursorPosition());
        return { kind: 'position', x: point.x, y: point.y };
      }
      case 'mouse_move': {
        await this.assertInBounds(action);
        await this.guard(() => this.controller.moveMouse(action.x, action.y));
        return { kind: 'ok' };
      }
      case 'left_click':
      case 'right_click':
      case 'middle_click': {
        await this.assertInBounds(action);
        const button = action.type === 'left_click' ? 'left' : action.type === 'right_click' ? 'right' : 'middle';
        await this.guard(() => this.controller.click(button, action.x, action.y));
        return { kind: 'ok' };
      }
      case 'double_click': {
        await this.assertInBounds(action);
        await this.guard(() => this.controller.doubleClick(action.x, action.y));
        return { kind: 'ok' };
      }
      case 'left_click_drag': {
        await this.assertInBounds(action.from);
        await this.assertInBounds(action.to);
        await this.guard(() => this.controller.drag(action.from, action.to));
        return { kind: 'ok' };
      }
      case 'type': {
        if (action.text.length === 0) {
          throw new ExecutorError('empty_input', 'type action requires non-empty text');
        }
        await this.guard(() => this.controller.typeText(action.text));
        return { kind: 'ok' };
      }
      case 'key': {
        const keys = parseKeyCombo(action.keys);
        if (keys.length === 0) {
          throw new ExecutorError('empty_input', 'key action requires at least one key');
        }
        await this.guard(() => this.controller.pressKeys(keys));
        return { kind: 'ok' };
      }
      case 'scroll': {
        await this.assertInBounds(action);
        if (!Number.isFinite(action.amount) || action.amount <= 0) {
          throw new ExecutorError('invalid_action', 'scroll amount must be a positive number');
        }
        await this.guard(() => this.controller.scroll(action.x, action.y, action.direction, action.amount));
        return { kind: 'ok' };
      }
      default: {
        // Exhaustiveness guard — also catches malformed actions at runtime.
        const unknown = action as { type?: unknown };
        throw new ExecutorError('invalid_action', `unknown action type: ${String(unknown.type)}`);
      }
    }
  }

  /** Validate that a point is finite and within the current screen bounds. */
  private async assertInBounds(point: Point): Promise<void> {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new ExecutorError('out_of_bounds', `coordinates must be finite numbers, got (${point.x}, ${point.y})`);
    }
    const size: ScreenSize = await this.guard(() => this.controller.screenSize());
    if (point.x < 0 || point.y < 0 || point.x >= size.width || point.y >= size.height) {
      throw new ExecutorError(
        'out_of_bounds',
        `point (${point.x}, ${point.y}) is outside screen ${size.width}x${size.height}`
      );
    }
  }

  /** Run a controller call, wrapping any failure as a controller_failure error. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ExecutorError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ExecutorError('controller_failure', `screen controller failed: ${message}`);
    }
  }
}
