import { describe, expect, it } from 'vitest';

const light = ['#0f766e', '#255f9e', '#6746ad', '#94600a', '#a83e69', '#4f5d75', '#b42318', '#52606d'];
const dark = ['#5eead4', '#93c5fd', '#c4b5fd', '#f2c66d', '#f0a3be', '#b8cad8', '#fda29b', '#cbd5e1'];

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}

describe('category palette', () => {
  it('keeps every light-theme label above WCAG AA contrast', () => {
    for (const color of light) expect(contrast(color, '#fffdfa')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps every dark-theme label above WCAG AA contrast', () => {
    for (const color of dark) expect(contrast(color, '#18201c')).toBeGreaterThanOrEqual(4.5);
  });

  it('uses a distinct color for every category', () => {
    expect(new Set(light).size).toBe(light.length);
    expect(new Set(dark).size).toBe(dark.length);
  });
});
