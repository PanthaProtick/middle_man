import { expect, it } from 'vitest';
import { assistantScrollTarget } from './assistantScroll';

it('anchors a long message at its first line', () => {
  expect(assistantScrollTarget({
    viewportHeight: 400, scrollHeight: 1400,
    newestTop: 700, newestHeight: 520,
  })).toBe(688);
});

it('follows the latest message when it fits in the feed', () => {
  expect(assistantScrollTarget({
    viewportHeight: 400, scrollHeight: 1000,
    newestTop: 820, newestHeight: 180,
  })).toBe(600);
});

it('never scrolls above the start of the feed', () => {
  expect(assistantScrollTarget({
    viewportHeight: 400, scrollHeight: 1200,
    newestTop: 4, newestHeight: 800,
  })).toBe(0);
});
