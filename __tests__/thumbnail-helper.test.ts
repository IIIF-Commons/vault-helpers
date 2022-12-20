import { thumbnailFixtures } from '../fixtures';
import { expect, test } from 'vitest';
import { Vault } from '@iiif/vault';
import { createThumbnailHelper } from '../src/thumbnail';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ManifestNormalized } from '@iiif/presentation-3';

describe('Thumbnail helper', function () {
  test.each(thumbnailFixtures as { label: string; description: string }[])(`Thumbnail - $label`, async (fixture) => {
    const vault = new Vault();
    const helper = createThumbnailHelper(vault);
    const manifestJson: any = JSON.parse(
      (await readFile(path.join(process.cwd(), 'fixtures/thumbnails', `${fixture.label}.json`))).toString()
    );
    const manifest = await vault.load<ManifestNormalized>(manifestJson.id || manifestJson['@id']);

    if (!manifest) {
      expect.fail(`Invalid manifest`);
    }

    const thumbnails = [];
    for (const canvas of manifest.items) {
      thumbnails.push(helper.getBestThumbnailAtSize(canvas, { width: 256, height: 256 }));
    }

    expect(await Promise.all(thumbnails)).toMatchSnapshot();
  });
});
