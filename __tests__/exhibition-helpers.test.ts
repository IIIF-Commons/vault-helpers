import novieten from '../fixtures/exhibitions/novieten.json';
import { Vault } from '@iiif/vault';
import { CanvasNormalized, Manifest } from '@iiif/presentation-3';
import invariant from 'tiny-invariant';
import { createPaintingAnnotationsHelper } from '../src/painting-annotations';
import { expandTarget } from '../src';

describe('Exhibition helpers', () => {
  test('parsing exhibition', async () => {
    const vault = new Vault();
    const manifest = await vault.load<Manifest>(novieten.id, novieten);

    expect(manifest).to.exist;
    invariant(manifest);

    const canvases = vault.get<CanvasNormalized>(manifest.items);
    const painting = createPaintingAnnotationsHelper(vault);

    const paintables = painting.getPaintables(canvases[0]);
    expect(paintables.items).toHaveLength(1);

    const expanded = expandTarget({
      type: 'SpecificResource',
      source: paintables.items[0].resource,
      selector: paintables.items[0].selector,
    });

    expect(expanded.selector).toMatchInlineSnapshot(`
      {
        "spatial": {
          "height": 2749,
          "unit": "pixel",
          "width": 2666,
          "x": 559,
          "y": 0,
        },
        "type": "BoxSelector",
      }
    `);
  });
});
