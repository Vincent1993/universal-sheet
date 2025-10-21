import { describe, expect, it, vi } from 'vitest';
import { createFilter } from '../src/core/createFilter.js';
import { createDataPipeline } from '../src/core/pipeline.js';
import { createInstanceRegistry, registerInstances } from '../src/core/registry.js';
import { createPresetPlugin, createMemoryPresetStorage, PRESET_PLUGIN_KEY } from '../src/plugins/presetPlugin.js';
import { createUrlSyncPlugin } from '../src/plugins/urlSyncPlugin.js';
import type { OptionSource, PresetPluginState, SchemaRegistrar } from '../src/core/types.js';

vi.mock('@formily/core', () => {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  const fields = new Map<string, any>();
  const form = {
    values: {} as Record<string, any>,
    setValues(values: any) {
      this.values = { ...values } as Record<string, any>;
      listeners.form?.forEach((fn) => fn());
    },
    async validate() {
      return Promise.resolve();
    },
    setFieldValue(path: string, value: any) {
      this.values[path] = value;
      const field = fields.get(path) ?? { value: undefined, initialValue: undefined };
      field.value = value;
      fields.set(path, field);
      listeners[`field:${path}`]?.forEach((fn) => fn({ ...field, path }));
      listeners['field:*']?.forEach((fn) => fn({ ...field, path }));
      listeners.form?.forEach((fn) => fn());
    },
    setFieldState(path: string, cb: (field: any) => void) {
      const field = fields.get(path) ?? {
        value: this.values[path],
        initialValue: undefined,
        display: 'visible',
        visible: true,
        disabled: false,
        validating: false,
        loading: false,
        selfErrors: [],
        errors: [],
      };
      fields.set(path, field);
      cb(field);
    },
    setFormState(cb: (state: any) => void) {
      cb({});
    },
    addEffects(_id: string, register: (form: any) => void) {
      register(this);
    },
    onFormValuesChange(cb: () => void) {
      listeners.form = listeners.form ?? [];
      listeners.form.push(cb);
      return () => {
        listeners.form = (listeners.form ?? []).filter((fn) => fn !== cb);
      };
    },
    onFieldValueChange(pattern: string, cb: (field: any) => void) {
      listeners[`field:${pattern}`] = listeners[`field:${pattern}`] ?? [];
      listeners[`field:${pattern}`]!.push(cb);
      return () => {
        listeners[`field:${pattern}`] = (listeners[`field:${pattern}`] ?? []).filter((fn) => fn !== cb);
      };
    },
  };

  return {
    createForm: () => form,
  };
});

vi.mock('@formily/json-schema', () => ({
  ISchema: {} as unknown,
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('FilterController', () => {
  it('applies values through the pipeline and emits listeners', async () => {
    const onApplySuccess = vi.fn();
    const pipeline = createDataPipeline([
      {
        name: 'encode-status',
        encode: (payload) => ({ ...payload, status: payload.status ?? 'active' }),
      },
    ]);

    const filter = createFilter({
      defaultValues: { search: '', status: '' },
      pipeline,
      listeners: {
        onApplySuccess,
      },
    });

    filter.getField('search').setValue('notebook');
    await filter.apply();

    expect(onApplySuccess).toHaveBeenCalledWith({
      draft: { search: 'notebook', status: '' },
      payload: { search: 'notebook', status: 'active' },
    });
  });

  it('resets grouped fields via group helpers', () => {
    const filter = createFilter({
      defaultValues: { status: '', keyword: '', region: '' },
      groups: [
        {
          id: 'basic',
          fields: ['status', 'keyword'],
        },
      ],
    });

    filter.getField('status').setValue('draft');
    filter.getField('keyword').setValue('phone');
    filter.clearErrors('group', 'basic');

    filter.reset('group', 'basic');

    expect(filter.draft).toEqual({ status: '', keyword: '', region: '' });
  });

  it('registers data shards for partial projections', () => {
    const filter = createFilter({
      defaultValues: { search: '', page: 1 },
    });

    const shard = filter.registerDataShard({
      id: 'search-shard',
      selector: ({ draft }) => ({ search: draft.search }),
    });

    const snapshots: string[] = [];
    const unsubscribe = shard.subscribe((value) => snapshots.push(value.search));

    filter.getField('search').setValue('tablet');
    filter.getField('search').setValue('laptop');

    expect(snapshots).toEqual(['', 'tablet', 'laptop']);

    shard.setSnapshot({ search: 'camera' });
    expect(filter.draft.search).toBe('camera');

    unsubscribe();
    shard.dispose();
  });

  it('creates headless roots for read-only projections', () => {
    const filter = createFilter({
      defaultValues: { search: '', page: 1 },
    });

    const root = filter.createHeadlessRoot({
      selector: (draft) => ({ page: draft.page }),
      apply: (api, snapshot) => {
        api.load({ page: snapshot.page }, { mode: 'merge', decode: false });
      },
    });

    const snapshots: number[] = [];
    root.subscribe((value) => snapshots.push(value.page));

    filter.getField('page').setValue(2);
    filter.getField('page').setValue(3);

    expect(snapshots).toEqual([1, 2, 3]);

    root.setSnapshot({ page: 8 });
    expect(filter.draft.page).toBe(8);

    root.dispose();
  });

  it('honours schema registrars and exposes groups', () => {
    const registrar: SchemaRegistrar = {
      name: 'demo-registrar',
      registerSchema: () => ({
        name: 'demo',
        schema: { type: 'object', properties: {} },
        meta: { groups: [{ id: 'advanced', fields: ['status'] }] },
      }),
      registerOptions: ({ root }) => {
        const source: OptionSource = {
          key: ['status'],
          fetcher: async () => [
            { label: '全部', value: '' },
            { label: '草稿', value: 'draft' },
          ],
        };
        root.registerOptionSource('status', source);
      },
    };

    const filter = createFilter({
      defaultValues: { status: '', keyword: '' },
      schemaRegistrar: registrar,
    });

    filter.load({ keyword: 'phone' }, { mode: 'merge', decode: false });

    expect(filter.draft).toEqual({ status: '', keyword: 'phone' });
    expect(filter.getOptionSource('status')?.key).toEqual(['status']);
    expect(filter.getGroups()).toEqual([{ id: 'advanced', fields: ['status'] }]);
  });

  it('wires preset plugins with namespaced storage', async () => {
    const storage = createMemoryPresetStorage<{ foo: string }>();
    const plugin = createPresetPlugin<{ foo: string }>({ storage, namespace: 'unit-test' });
    const filter = createFilter<{ foo: string }>({
      defaultValues: { foo: 'alpha' },
      plugins: [plugin],
    });

    await flush();

    const state = filter.getPluginState<PresetPluginState<{ foo: string }>>(PRESET_PLUGIN_KEY);
    expect(state?.namespace).toBe('unit-test');

    const preset = { id: 'p1', name: 'First', values: { foo: 'beta' }, updatedAt: 1 };
    state!.storage.save(state!.namespace, preset);
    state!.storage.save(state!.namespace, { ...preset, name: 'Updated', updatedAt: 2 });

    const [snapshot] = state!.storage.list(state!.namespace);
    expect(snapshot.name).toBe('Updated');
    filter.load(snapshot.values, { mode: 'replace', decode: false });
    expect(filter.draft.foo).toBe('beta');
  });

  it('synchronises with URL adapters via plugin hooks', async () => {
    let currentSearch = '?status=draft';
    const writes: string[] = [];
    let onChange: ((search: string) => void) | undefined;

    const adapter = {
      read: () => currentSearch,
      write: (search: string) => {
        currentSearch = search;
        writes.push(search);
      },
      subscribe: (listener: (search: string) => void) => {
        onChange = listener;
        return () => {
          onChange = undefined;
        };
      },
    };

    const plugin = createUrlSyncPlugin<{ status: string }>({ adapter });
    const filter = createFilter<{ status: string }>({
      defaultValues: { status: '' },
      plugins: [plugin],
    });

    await flush();
    expect(filter.draft.status).toBe('draft');

    filter.getField('status').setValue('active');
    await filter.apply();
    expect(writes[writes.length - 1]).toContain('status=active');

    onChange?.('?status=archived');
    expect(filter.draft.status).toBe('archived');
  });

  it('registers multiple instances through helper utilities', () => {
    const registry = createInstanceRegistry<{ foo: string }>();
    const first = createFilter<{ foo: string }>({ defaultValues: { foo: 'one' } });
    const second = createFilter<{ foo: string }>({ defaultValues: { foo: 'two' } });

    registerInstances(registry, [
      { namespace: 'first', instance: first, makeDefault: true },
      { namespace: 'second', instance: second },
    ]);

    expect(registry.get('first')).toBe(first);
    expect(registry.get('second')).toBe(second);
    expect(registry.getDefault()).toBe(first);
  });

  it('supports memory preset storage subscriptions with namespaces', () => {
    const storage = createMemoryPresetStorage<{ foo: string }>();
    const listener = vi.fn();
    const unsubscribe = storage.subscribe ? storage.subscribe('demo', listener) : undefined;

    storage.save('demo', { id: 'a', name: 'first', values: { foo: 'bar' }, updatedAt: 1 });
    storage.remove('demo', 'a');

    unsubscribe?.();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
