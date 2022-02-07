import {
  AnnotationNormalized,
  AnnotationPageNormalized,
  CanvasNormalized,
  ChoiceBody,
  CollectionItemSchemas,
  CollectionNormalized,
  ContentResource,
  ManifestNormalized,
  Reference,
} from '@iiif/presentation-3';
import { Vault } from '@iiif/vault';
import {
  FixedSizeImage,
  FixedSizeImageService,
  getFixedSizeFromImage,
  ImageCandidate,
  ImageCandidateRequest,
  ImageServiceLoader,
  UnknownSizeImage,
  VariableSizeImage,
} from '@atlas-viewer/iiif-image-api';

export function createThumbnailHelper(vault: Vault, dependencies: { imageServiceLoader?: ImageServiceLoader } = {}) {
  const imageServiceLoader = dependencies.imageServiceLoader || new ImageServiceLoader();

  async function getBestThumbnailAtSize(
    input:
      | string
      | Reference<CollectionItemSchemas>
      | Reference<'Collection'>
      | Reference<'Manifest'>
      | Reference<'Canvas'>
      | Reference<'Annotation'>
      | Reference<'AnnotationPage'>
      | Reference<'ContentResource'>
      | CollectionNormalized
      | ManifestNormalized
      | CanvasNormalized
      | AnnotationNormalized
      | AnnotationPageNormalized
      | ContentResource,
    request: ImageCandidateRequest,
    dereference?: boolean,
    candidates: Array<ImageCandidate> = [],
    dimensions?: { width: number; height: number }
  ): Promise<{
    best: null | undefined | FixedSizeImage | FixedSizeImageService | VariableSizeImage | UnknownSizeImage;
    fallback: Array<ImageCandidate>;
    log: string[];
  }> {
    if (typeof input === 'string') {
      // Best shot we have.
      return { best: getFixedSizeFromImage(input as any), fallback: [], log: [] };
    }

    // Run through from ref, just in case.
    const fullInput:
      | string
      | ManifestNormalized
      | CollectionNormalized
      | CanvasNormalized
      | AnnotationNormalized
      | AnnotationPageNormalized
      | ContentResource = vault.get(input as any) as any;

    if (typeof fullInput === 'string') {
      return { best: getFixedSizeFromImage(fullInput as any), fallback: [], log: [] };
    }

    switch (fullInput.type) {
      case 'Annotation': {
        // Grab the body.
        const contentResources = fullInput.body;
        // @todo this could be configuration.
        const firstContentResources = vault.get<ContentResource>(contentResources[0]);
        if (dimensions && !(firstContentResources as any).width) {
          (firstContentResources as any).width = dimensions.width;
          (firstContentResources as any).height = dimensions.height;
        }

        return await imageServiceLoader.getThumbnailFromResource(
          firstContentResources as any,
          request,
          dereference,
          candidates
        );
      }

      case 'Canvas': {
        const canvas = fullInput as CanvasNormalized;
        // check for thumbnail resource first?
        if (canvas.thumbnail && canvas.thumbnail.length) {
          const thumbnail = vault.get<ContentResource>(canvas.thumbnail[0]);
          const potentialThumbnails = await imageServiceLoader.getImageCandidates(thumbnail as any, dereference);
          if (potentialThumbnails && potentialThumbnails.length) {
            candidates.push(...potentialThumbnails);
          }
        }

        return getBestThumbnailAtSize(canvas.items[0], request, dereference, candidates, {
          width: canvas.width,
          height: canvas.height,
        });
      }

      // Unsupported for now.
      case 'AnnotationPage': {
        const annotationPage = fullInput as AnnotationPageNormalized;
        return getBestThumbnailAtSize(annotationPage.items[0], request, dereference, candidates, dimensions);
      }

      case 'Choice': {
        const choice: ChoiceBody = fullInput as any;
        // @todo this could also be configuration, just choosing the first choice.
        return getBestThumbnailAtSize(choice.items[0] as any, request, dereference, candidates, dimensions);
      }
      case 'Collection': {
        // This one is tricky, as the manifests may not have been loaded. But we will give it a shot.
        const collection = fullInput as CollectionNormalized;
        const firstManifest = collection.items[0];
        return getBestThumbnailAtSize(firstManifest, request, dereference, candidates, dimensions);
      }

      case 'Manifest': {
        const manifest = fullInput as ManifestNormalized;
        const firstCanvas = manifest.items[0];
        return getBestThumbnailAtSize(firstCanvas, request, dereference, candidates, dimensions);
      }

      case 'SpecificResource':
      case 'Image':
      case 'Dataset':
      case 'Sound':
      case 'Text':
      case 'TextualBody':
      case 'Video':
        if (dimensions && !(fullInput as any).width) {
          (fullInput as any).width = dimensions.width;
          (fullInput as any).height = dimensions.height;
        }

        return imageServiceLoader.getThumbnailFromResource(fullInput as any, request, dereference, candidates);

      // Seems unlikely these would appear, but it would be an error..
      case 'Service': // @todo could do something with vault.
      case 'Range':
      case 'AnnotationCollection':
      case 'CanvasReference':
      case 'ContentResource':
        return { best: undefined, fallback: [], log: [] };
    }

    return { best: undefined, fallback: [], log: [] };
  }

  return {
    getBestThumbnailAtSize,
  };
}
