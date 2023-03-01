import { describe } from 'vitest';
import { svgSelectorEditor } from '../src/selector-editors/svg-selector-editor';
import { parseSelector } from '../src';
import invariant from 'tiny-invariant';
import { transitionState } from '../src/selector-editors/transition-state';

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

  describe('transition', () => {
    const TOP_LEFT = 0;
    const TOP_RIGHT = 1;
    const BOTTOM_RIGHT = 2;
    const BOTTOM_LEFT = 3;

    const testBox: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ];
    test('starting a transition', () => {
      const transition = transitionState();
      const { startTransition } = transition.getState();
      // Start the transition.
      startTransition({
        points: testBox,
      });

      expect(transition.getState().points).toEqual(testBox);
    });

    test('translation', () => {
      const transition = transitionState();
      const { startTransition, translate } = transition.getState();

      startTransition({
        points: testBox,
      });

      // Translate x by 1.
      translate([1, 0]);

      expect(transition.getState().points[0][0]).to.eq(1);
    });

    test('translation - multiple', () => {
      const transition = transitionState();
      const { startTransition, translate } = transition.getState();

      startTransition({
        points: testBox,
      });

      // Translate 3 times, only the latest should be applied.
      translate([1, 0]);
      translate([10, 0]);
      translate([4, 0]);

      expect(transition.getState().points[0][0]).to.eq(4);
    });

    test('translation - from origin', () => {
      const transition = transitionState();
      const { startTransition, translate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [10, 10],
      });

      // Translate 1,2 from the origin.
      translate([11, 12]);

      expect(transition.getState().points[0][0]).to.eq(1);
      expect(transition.getState().points[0][1]).to.eq(2);
    });

    test('translation - with scale', () => {
      const transition = transitionState();
      const { startTransition, translate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [10, 10],
        pointScale: 1 / 4, // 4x movement from the source
      });

      // Translate 1,2 from the origin.
      translate([14, 18]);

      expect(transition.getState().points[0][0]).to.eq(1);
      expect(transition.getState().points[0][1]).to.eq(2);
    });

    test('translation - active points', () => {
      const transition = transitionState();
      const { startTransition, translate } = transition.getState();

      startTransition({
        points: testBox,
        activePoints: [TOP_RIGHT, BOTTOM_RIGHT],
      });

      expect(transition.getState().activePoints).toContain(TOP_RIGHT);
      expect(transition.getState().activePoints).toContain(BOTTOM_RIGHT);

      translate([10, 20]);

      expect(transition.getState().points).toEqual([
        //
        testBox[TOP_LEFT],
        [10, 21],
        [11, 21],
        testBox[BOTTOM_LEFT],
      ]);
    });
  });

  describe('rotation', () => {
    const TOP_LEFT = 0;
    const TOP_RIGHT = 1;
    const BOTTOM_RIGHT = 2;
    const BOTTOM_LEFT = 3;

    const origin = [50, 50];

    const deg = (rad: number) => rad * (180 / Math.PI);
    const rad = (deg: number) => (deg * 180) / Math.PI;

    const testBox: [number, number][] = [
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
    ];

    test('starting a rotation at the center of a box', () => {
      const transition = transitionState();
      const { startTransition, rotate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [50, 50],
      });

      // Test a parallel line = no rotation
      rotate([100, 50]);

      expect(transition.getState().currentRotation).toEqual(0);
    });

    test('45 rotation', () => {
      const transition = transitionState();
      const { startTransition, rotate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [50, 50],
      });

      // 45 degrees rotation to the bottom right corner
      rotate([100, 100]);

      expect(transition.getState().currentRotation).toEqual(45);
    });

    test('90 rotation', () => {
      const transition = transitionState();
      const { startTransition, rotate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [50, 50],
      });

      // 90 degrees rotation to the bottom, parallel to the origin
      rotate([50, 100]);

      expect(transition.getState().currentRotation).toEqual(90);
    });

    test('135 rotation', () => {
      const transition = transitionState();
      const { startTransition, rotate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [50, 50],
      });

      // 135
      rotate([0, 100]);

      expect(transition.getState().currentRotation).toEqual(135);
    });

    test('180 rotation', () => {
      const transition = transitionState();
      const { startTransition, rotate } = transition.getState();

      startTransition({
        points: testBox,
        origin: [50, 50],
      });

      rotate([0, 50]);

      expect(transition.getState().currentRotation).toEqual(180);
    });
  });
});
