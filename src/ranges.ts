import { Reference } from '@iiif/presentation-3';
import { ManifestNormalized, RangeNormalized } from '@iiif/presentation-3-normalized';
import { CompatVault, compatVault } from './compat';

export function createRangeHelper(vault: CompatVault = compatVault) {
  return {
    findFirstCanvasFromRange: (range: RangeNormalized) => findFirstCanvasFromRange(vault, range),
    findAllCanvasesInRange: (range: RangeNormalized) => findAllCanvasesInRange(vault, range),
    findManifestSelectedRange: (manifest: ManifestNormalized, canvasId: string) =>
      findManifestSelectedRange(vault, manifest, canvasId),
    findSelectedRange: (range: RangeNormalized, canvasId: string) => findSelectedRange(vault, range, canvasId),
  };
}

export function findFirstCanvasFromRange(vault: CompatVault, range: RangeNormalized): null | Reference<'Canvas'> {
  for (const inner of range.items) {
    if (inner.type === 'SpecificResource') {
      if (inner.source?.type === 'Canvas') {
        return inner.source as Reference<'Canvas'>;
      }
    }
    if (inner.type === 'Range') {
      const found = findFirstCanvasFromRange(vault, vault.get(inner));
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findAllCanvasesInRange(vault: CompatVault, range: RangeNormalized): Array<Reference<'Canvas'>> {
  const found: Reference<'Canvas'>[] = [];
  for (const inner of range.items) {
    if (inner.type === 'SpecificResource') {
      if (inner.source?.type === 'Canvas') {
        if (inner.source.id.indexOf('#') !== -1) {
          found.push({ id: inner.source.id.split('#')[0], type: 'Canvas' });
        } else {
          found.push(inner.source as Reference<'Canvas'>);
        }
      }
    }
    if (inner.type === 'Range') {
      found.push(...findAllCanvasesInRange(vault, vault.get(inner)));
    }
  }
  return found;
}

export function findManifestSelectedRange(
  vault: CompatVault,
  manifest: ManifestNormalized,
  canvasId: string
): null | RangeNormalized {
  for (const range of manifest.structures) {
    const found = findSelectedRange(vault, vault.get(range), canvasId);
    if (found) {
      return found;
    }
  }

  return null;
}

export function findSelectedRange(
  vault: CompatVault,
  range: RangeNormalized,
  canvasId: string
): null | RangeNormalized {
  for (const inner of range.items) {
    if ((inner as any).type === 'SpecificResource' && (inner as any).source === canvasId) {
      return range;
    }
    if (inner.type === 'Range') {
      const found = findSelectedRange(vault, vault.get(inner), canvasId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
