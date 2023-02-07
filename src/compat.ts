export type CompatVault = {
  get: import('@iiif/vault').Vault['get'];
};

export const compatVault: CompatVault = {
  get(nonRef: any) {
    return nonRef;
  },
};
