import { createRollupConfig, createTypeConfig } from 'rollup-library-template';

const baseConfig = {
  filesize: true,
  minify: true,
  extra: {
    treeshake: true,
  },
};

const external = ['@iiif/vault', '@iiif/parser', 'redux', 'typesafe-actions'];
const nodeExternal = ['node-fetch'];

function singleFileHelper(name) {
  return [
    createTypeConfig({
      source: `./.build/types/${name}.d.ts`,
      dist: `./dist/${name}.d.ts`,
    }),
    createRollupConfig({
      ...baseConfig,
      input: `./src/${name}.ts`,
      dist: `dist/${name}`,
      distPreset: 'esm',
      external,
    }),
    createRollupConfig({
      ...baseConfig,
      input: `./src/${name}.ts`,
      dist: `dist/${name}`,
      distPreset: 'cjs',
      external,
    }),
  ];
}

// Roll up configs
export default [
  createTypeConfig({
    source: './.build/types/index.d.ts',
  }),

  // UMD bundle will have everything.
  createRollupConfig({
    ...baseConfig,
    inlineDynamicImports: true,
    input: './src/index.ts',
    output: {
      name: 'IIIFVaultHelpers',
      file: `dist/index.umd.js`,
      format: 'umd',
    },
    nodeResolve: {
      browser: false,
    },
  }),
  createRollupConfig({
    ...baseConfig,
    input: './src/index.ts',
    distPreset: 'esm',
    external,
  }),
  createRollupConfig({
    ...baseConfig,
    input: './src/index.ts',
    distPreset: 'cjs',
    external,
  }),

  ...singleFileHelper('events'),
  ...singleFileHelper('styles'),
  ...singleFileHelper('thumbnail'),
  ...singleFileHelper('i18n'),

  // React i18next
  createRollupConfig({
    ...baseConfig,
    input: `./src/react-i18next.tsx`,
    dist: `dist/react-i18next`,
    distPreset: 'esm',
    external: [...external, 'react', 'react-i18next'],
  }),
  createRollupConfig({
    ...baseConfig,
    input: `./src/react-i18next.tsx`,
    dist: `dist/react-i18next`,
    distPreset: 'cjs',
    external: [...external, 'react', 'react-i18next'],
  }),
];
