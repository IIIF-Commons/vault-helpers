import { Vault } from '@iiif/vault';
import { Reference } from '@iiif/presentation-3';

export function unwrapObject(object: any): any {
  if (Array.isArray(object)) {
    return object.map((o) => unwrapObject(o)) as any;
  }

  if (!object || !object.type) {
    return object;
  }

  return { id: object.id, type: object.type };
}

export function wrapObject(object: any, vault: Vault, reactive = false): any {
  return vault.wrapObject(object);
}

export function createObjectsHelper(vault: Vault) {
  return {
    get(id: string | Reference | string[] | Reference[], reactive = false) {
      return vault.getObject(id as any, { reactive });
    },
    async load(id: string | Reference<any>, json?: any) {
      return vault.loadObject(id as any, json);
    },
    async loadManifest(id: string | Reference<any>, json?: any) {
      return vault.loadManifestObject(id as any, json);
    },
    async loadCollection(id: string | Reference<any>, json?: any) {
      return vault.loadCollectionObject(id as any, json);
    },
    wrapObject<T>(objectType: Reference<T>) {
      return vault.wrapObject(vault.get(objectType as any, { skipSelfReturn: false }));
    },
    isWrapped(object: any) {
      return vault.isWrapped(object);
    },
  };
}
