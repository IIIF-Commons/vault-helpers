import { Vault } from '@iiif/vault';
import { Manifest } from '@iiif/presentation-3';
import { Reference } from '@iiif/presentation-3/reference';

function defineProperty(name: string, prototype: any, vault: Vault) {
  Object.defineProperty(prototype, name, {
    get(): any {
      if (typeof this._refs_[name] === 'undefined') {
        return undefined;
      }

      const ref = this._refs_[name];
      if (!ref) {
        return ref;
      }

      return wrapObject(vault.get(this._refs_[name]), vault);
    },
    set(items: any) {
      this._refs_[name] = items;
    },
  });
}

function createPrototype(vault: Vault) {
  const prototype = {
    id: null,
    _refs_: {},
    toJSON() {
      const that = this as any;
      return {
        ...that,
        items: that.items,
        annotations: that.annotations,
        structures: that.structures,
        seeAlso: that.seeAlso,
        service: that.service,
        services: that.services,
        rendering: that.rendering,
        partOf: that.partOf,
        start: that.start,
        supplementary: that.supplementary,
        homepage: that.homepage,
        thumbnail: that.thumbnail,
        placeholderCanvas: that.placeholderCanvas,
        accompanyingCanvas: that.accompanyingCanvas,
        provider: that.provider,
      };
    },
    subscribe(subscription: (object: any, vault: Vault) => void, skipInitial = true) {
      return vault.subscribe(
        () => {
          return this.id ? vault.get(this.id) : null;
        },
        subscription,
        skipInitial
      );
    },
  };

  // Structural
  defineProperty('items', prototype, vault);
  defineProperty('annotations', prototype, vault);
  defineProperty('structures', prototype, vault);
  // Linking
  defineProperty('seeAlso', prototype, vault);
  defineProperty('service', prototype, vault);
  defineProperty('services', prototype, vault);
  defineProperty('rendering', prototype, vault);
  defineProperty('partOf', prototype, vault);
  defineProperty('start', prototype, vault);
  defineProperty('supplementary', prototype, vault);
  defineProperty('homepage', prototype, vault);

  // Descriptive
  defineProperty('thumbnail', prototype, vault);
  defineProperty('placeholderCanvas', prototype, vault);
  defineProperty('accompanyingCanvas', prototype, vault);
  defineProperty('provider', prototype, vault);

  // Annotation
  defineProperty('body', prototype, vault);
  defineProperty('logo', prototype, vault);

  return prototype;
}

export function wrapObject(object: any, vault: Vault): any {
  if (Array.isArray(object)) {
    return object.map((o) => wrapObject(o, vault));
  }

  if (!object || !object.type) {
    return object;
  }

  const prototype = createPrototype(vault);
  const newObject = Object.create(prototype);

  return Object.assign(newObject, object) as any;
}

export function createObjectsHelper(vault: Vault) {
  return {
    async createManifest(id: string): Promise<Manifest> {
      return wrapObject(await vault.loadManifest(id), vault);
    },
    async createCollection(id: string) {
      return wrapObject(await vault.loadCollection(id), vault);
    },
    wrapObject<T>(objectType: Reference<T>) {
      return wrapObject(vault.get(objectType, { skipSelfReturn: false }), vault);
    },
  };
}
