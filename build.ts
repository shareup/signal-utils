import { build, emptyDir } from '@deno/dnt'

await emptyDir('./npm')

await build({
  scriptModule: false,
  compilerOptions: {
    target: 'Latest'
  },
  entryPoints: ['./mod.ts'],
  outDir: './npm',
  importMap: 'deno.json',
  shims: {
    deno: {
      test: 'dev'
    }
  },
  package: {
    name: '@shareup/array-signal-utils',
    version: '0.0.1',
    description: 'Smart reactive array-like wrappers around preact signals with array values',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/shareup/array-signal-utils.git'
    }
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync('LICENSE', 'npm/LICENSE')
    Deno.copyFileSync('README.md', 'npm/README.md')
  }
})