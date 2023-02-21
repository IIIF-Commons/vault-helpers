import { describe } from 'vitest';
import { svgSelectorEditor } from '../src/selector-editors/svg-selector-editor';
import { parseSelector } from '../src';
import invariant from 'tiny-invariant';

describe('Svg selector editor', () => {
  test('Simple editor', () => {
    const parsed = parseSelector({
      type: 'SvgSelector',
      value: `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><g><rect x="100" y="100" width="300" height="300"></rect></g></svg>`,
    });

    invariant(parsed.selector && parsed.selector.type === 'SvgSelector');

    const store = svgSelectorEditor(parsed.selector, {
      initiallyOpen: true,
      recalculateSvg: true,
      recalculateSvgAs: 'polygon',
    });

    const { pushPoint, recalculateSvgAsPolygon, closeShape } = store.getState();

    pushPoint(140, 140);
    closeShape();

    expect(store.getState().svg).toMatchInlineSnapshot(
      '"<svg height=\\"600\\" width=\\"800\\" xmlns=\\"http://www.w3.org/2000/svg\\"><g><polygon points=\\"100,100 400,100 400,400 100,400 140,140\\" /></g></svg>"'
    );
  });
});
