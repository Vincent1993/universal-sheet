# universal-sheet

A headless filtering toolkit aligned with the "全局筛选器体系" design. The library wraps Formily forms, TanStack Query option loaders, and a plugin-friendly controller so that product teams can compose complex filter experiences.

Key capabilities:

- **Formily-first core** – `createFilter` instantiates a Formily form, and `FilterConfigure` wires global defaults, namespace registries, and listener/plugin merging strategies.
- **Headless React hooks** – `useFilter`, `useField`, and `useOptions` expose Formily state while options flow through TanStack Query; preset management now ships as a plugin + hook pairing.
- **Data pipeline & shards** – `createDataPipeline` and `filter.registerDataShard` coordinate encode/decode steps with partial state projections so payloads can be split across services.
- **Multiple roots & groups** – `filter.createHeadlessRoot` and group-aware reset helpers let products fan out independent controllers while keeping sections in sync.
- **Plugin ecosystem** – presets, URL synchronisation, and history tracking illustrate lifecycle hooks; helpers like `registerInstances` seed multi-instance registries.

## Getting started

```bash
pnpm install
```

### Scripts

- `pnpm run build` – bundle the library with **rslib**
- `pnpm run lint` – run ESLint using the configured TypeScript rules
- `pnpm run test` – execute the Vitest suite
- `pnpm run typecheck` – run the TypeScript compiler without emitting files

### Project layout

```
src/
  adapters/      # bridge the core filter into different environments
  core/          # createFilter/useFilter/useField/useOptions/pipeline helpers
  examples/      # usage snippets (basic usage, pipelines, multi-root projections)
  plugins/       # extensions that react to filter lifecycle events
__tests__/       # Vitest specs
```

### Examples

- `src/examples/basic.ts` – create a filter, attach plugins, and persist via the memory adapter.
- `src/examples/pipeline.ts` – define a codec pipeline that translates between backend payloads and the Formily draft.
- `src/examples/multipleRoots.ts` – fan out a headless pagination controller from the main filter state.
