import { createForm } from '@formily/core';
import { cloneDeep } from 'es-toolkit/clone-deep';
import { isEqual } from 'es-toolkit/is-equal';
import { merge } from 'es-toolkit/merge';
import type {
  DataPipeline,
  DataShardHandle,
  DataShardOptions,
  Draft,
  FieldApi,
  FilterApi,
  FilterGroup,
  FilterListeners,
  FilterOptions,
  HeadlessRoot,
  HeadlessRootOptions,
  LoadOptions,
  OptionSource,
  Plugin,
  RegisteredSchema,
  SchemaRegistrar,
  TransformContext,
} from './types.js';
import { OptionsRegistry } from './optionsRegistry.js';
import { createFieldApi } from './fieldHelpers.js';
import { ERROR_CODES, FilterError } from './errors.js';
import { getGlobalConfigure } from './configure.js';
import { mergeListeners, mergePlugins } from './lifecycle.js';
import { compileSchema } from './schema.js';

interface InternalState<TDraft> {
  appliedDraft?: TDraft;
  appliedPayload?: any;
  registrar?: SchemaRegistrar<TDraft>;
  schema?: RegisteredSchema<TDraft>;
}

interface HeadlessRecord<TRoot> {
  snapshot: TRoot;
  listeners: Set<(value: TRoot) => void>;
  unsubscribe: () => void;
}

interface DataShardRecord<TSlice> {
  snapshot: TSlice;
  selector: (state: { draft: any; applied?: any }) => TSlice;
  projector: (root: FilterApi<any>, slice: TSlice) => void;
  listeners: Set<(value: TSlice) => void>;
  unsubscribe: () => void;
}

export class FilterController<TDraft extends Draft> implements FilterApi<TDraft> {
  readonly id: string;
  readonly form = createForm({ values: {} });
  readonly options = new OptionsRegistry();

  draft: TDraft;
  applied?: TDraft;
  validating = false;
  schema?: RegisteredSchema<TDraft>;

  private listeners: FilterListeners<TDraft> | undefined;
  private plugins: Plugin<TDraft>[] = [];
  private defaultValues: TDraft;
  private state: InternalState<TDraft> = {};
  private readonly subscribers = new Set<(state: { draft: TDraft; applied?: TDraft }) => void>();
  private readonly roots = new Map<string, HeadlessRecord<any>>();
  private readonly shards = new Map<string, DataShardRecord<any>>();
  private readonly groups = new Map<string, FilterGroup>();
  private readonly pluginState = new Map<string | symbol, unknown>();
  private readonly strict: boolean;
  private readonly transform?: (input: any, ctx: TransformContext<TDraft>) => any;
  private readonly pipeline?: DataPipeline<TDraft>;
  private readonly applyDebounce: number;

  constructor(private readonly optionsConfig: FilterOptions<TDraft> = {}) {
    const configure = getGlobalConfigure<TDraft>();
    const defaults = configure.defaults ?? {};
    const mergeStrategy = configure.mergeStrategy ?? { plugins: 'append', listeners: 'shallow' };

    this.listeners = mergeListeners(defaults.listeners, optionsConfig.listeners, mergeStrategy.listeners ?? 'shallow');
    this.plugins = mergePlugins(defaults.plugins ?? [], optionsConfig.plugins ?? [], mergeStrategy.plugins ?? 'append');

    this.strict = optionsConfig.strict ?? defaults.strict ?? false;
    this.transform = optionsConfig.transform ?? defaults.transform;
    this.pipeline = optionsConfig.pipeline ?? defaults.pipeline;
    this.applyDebounce = optionsConfig.applyDebounceMs ?? defaults.applyDebounceMs ?? 0;

    this.defaultValues = cloneDeep((optionsConfig.defaultValues ?? {}) as TDraft);
    this.draft = cloneDeep(this.defaultValues);
    this.applied = cloneDeep(this.defaultValues);
    this.state.appliedDraft = cloneDeep(this.defaultValues);
    this.state.appliedPayload = cloneDeep(this.defaultValues);
    this.form.setValues(cloneDeep(this.defaultValues));

    this.id = `filter-${Math.random().toString(36).slice(2, 8)}`;

    this.setGroups(optionsConfig.groups ?? defaults.groups ?? convertSectionsToGroups(optionsConfig.sections));

    this.setupFormEffects();
    this.listeners?.onInit?.({ root: this });
    void this.runPluginsInit();

    if (optionsConfig.schemaRegistrar) {
      this.installSchema(optionsConfig.schemaRegistrar, 'reset');
    }
  }

  async apply(): Promise<void> {
    const snapshot = cloneDeep(this.form.values as TDraft);
    this.listeners?.onApplyStart?.({ draft: snapshot });

    try {
      this.validating = true;
      await this.form.validate();
    } catch (error) {
      this.listeners?.onApplyError?.(error);
      this.validating = false;
      throw error;
    }
    this.validating = false;

    if (this.applyDebounce > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.applyDebounce));
    }

    const ctx: TransformContext<TDraft> = { root: this, schema: this.schema };
    let payload: any = cloneDeep(snapshot);
    try {
      if (this.pipeline) {
        payload = this.pipeline.encode(cloneDeep(snapshot), ctx);
      }
      if (this.transform) {
        payload = this.transform(cloneDeep(payload), ctx);
      }
    } catch (error) {
      this.listeners?.onApplyError?.(error);
      throw new FilterError(ERROR_CODES.CODEC_ENCODE_FAILED, 'Failed to transform filter payload');
    }

    this.state.appliedDraft = cloneDeep(snapshot);
    this.state.appliedPayload = payload;
    this.applied = cloneDeep(snapshot);
    this.broadcast();
    this.listeners?.onApplySuccess?.({ draft: snapshot, payload });
    void this.runPluginsAfterApply({ draft: snapshot, payload });
  }

  reset(scope: 'all' | 'group' | string = 'all', target?: string): void {
    if (scope === 'all') {
      this.form.setValues(cloneDeep(this.defaultValues));
      this.draft = cloneDeep(this.defaultValues);
      this.listeners?.onReset?.({ scope: 'all' });
      this.broadcast();
      return;
    }

    if (scope === 'group') {
      const id = ensureGroupId(target);
      this.resetGroup(id, 'default');
      this.listeners?.onReset?.({ scope: 'group', target: id });
      return;
    }

    const next = readAtPath(this.defaultValues, scope);
    this.form.setFieldValue(scope, cloneDeep(next));
    this.listeners?.onReset?.({ scope: 'field', target: scope });
    this.updateDraftFromForm();
  }

  resetValue(
    scope: 'all' | 'group' | string = 'all',
    target?: string,
    mode: 'initial' | 'default' | 'applied' = 'default'
  ): void {
    if (scope === 'group') {
      const id = ensureGroupId(target);
      const resolvedMode = resolveMode(undefined, mode);
      this.resetGroup(id, resolvedMode);
      return;
    }

    const resolvedMode = resolveMode(target as any, mode);
    const source = this.getSourceByMode(resolvedMode);

    if (scope === 'all') {
      this.form.setValues(cloneDeep(source));
      this.updateDraftFromForm();
      return;
    }

    const value = readAtPath(source, scope);
    this.form.setFieldValue(scope, cloneDeep(value));
    this.updateDraftFromForm();
  }

  clearErrors(scope: 'all' | 'group' | string = 'all', target?: string): void {
    if (scope === 'all') {
      this.form.setFormState((state) => {
        state.validating = false;
        state.clearing = true;
        state.errors = [];
      });
      return;
    }

    if (scope === 'group') {
      const id = ensureGroupId(target);
      for (const fieldPath of this.getGroupFields(id)) {
        this.form.setFieldState(fieldPath, (field) => {
          field.errors = [];
        });
      }
      return;
    }

    this.form.setFieldState(scope, (field) => {
      field.errors = [];
    });
  }

  async validateAll(): Promise<void> {
    this.validating = true;
    try {
      await this.form.validate();
    } finally {
      this.validating = false;
    }
  }

  registerOptionSource(path: string, source: OptionSource): void {
    this.options.register(path, source);
  }

  removeOptionSource(path: string): void {
    this.options.remove(path);
  }

  getOptionSource(path: string): OptionSource | undefined {
    return this.options.get(path);
  }

  getField(path: string): FieldApi {
    return createFieldApi(this.form as any, path, (mode) => this.resetValue(path, mode));
  }

  subscribe(listener: (state: { draft: TDraft; applied?: TDraft }) => void): () => void {
    this.subscribers.add(listener);
    listener({ draft: this.draft, applied: this.applied });
    return () => this.subscribers.delete(listener);
  }

  setSchemaRegistrar(registrar: SchemaRegistrar<TDraft>, mode: 'preserve' | 'reset' = 'reset'): void {
    this.installSchema(registrar, mode);
  }

  createHeadlessRoot<TRoot = TDraft>(options: HeadlessRootOptions<TDraft, TRoot> = {}): HeadlessRoot<TRoot> {
    const selector = options.selector ?? ((draft: TDraft) => draft as unknown as TRoot);
    const apply = options.apply ?? ((root: FilterApi<TDraft>, next: TRoot) => {
      root.load(next as unknown as TDraft, { mode: 'replace', decode: false });
    });
    const id = options.id ?? `${this.id}-root-${Math.random().toString(36).slice(2, 8)}`;

    let snapshot = cloneDeep(selector(this.draft));
    const listeners = new Set<(value: TRoot) => void>();

    const notify = (value: TRoot) => {
      for (const listener of listeners) {
        listener(cloneDeep(value));
      }
    };

    const unsubscribe = this.subscribe(({ draft }) => {
      const next = cloneDeep(selector(draft));
      if (!isEqual(next, snapshot)) {
        snapshot = cloneDeep(next);
        notify(snapshot);
      }
    });

    const record: HeadlessRecord<TRoot> = {
      snapshot,
      listeners,
      unsubscribe,
    };
    this.roots.set(id, record);

    const root: HeadlessRoot<TRoot> = {
      id,
      getSnapshot: () => cloneDeep(snapshot),
      setSnapshot: (next) => {
        snapshot = cloneDeep(next);
        apply(this, cloneDeep(next));
      },
      subscribe: (listener) => {
        listeners.add(listener);
        if (options.immediate ?? true) {
          listener(cloneDeep(snapshot));
        }
        return () => {
          listeners.delete(listener);
        };
      },
      dispose: () => {
        record.unsubscribe();
        listeners.clear();
        this.roots.delete(id);
      },
    };

    return root;
  }

  load(values: Partial<TDraft>, options: LoadOptions<TDraft> = {}): void {
    const mode = options.mode ?? 'replace';
    const decode = options.decode ?? true;
    const ctx: TransformContext<TDraft> = { root: this, schema: this.schema };
    let incoming: Partial<TDraft> = cloneDeep(values);

    if (decode && this.pipeline) {
      try {
        incoming = this.pipeline.decode(values as TDraft, ctx);
      } catch (error) {
        throw new FilterError(ERROR_CODES.CODEC_DECODE_FAILED, 'Failed to decode filter payload');
      }
    }

    if (mode === 'merge') {
      const merged = merge(cloneDeep(this.form.values as TDraft), incoming as Record<string, any>);
      this.form.setValues(cloneDeep(merged));
    } else {
      this.form.setValues(cloneDeep(incoming));
    }
    this.updateDraftFromForm();
  }

  getPipeline(): DataPipeline<TDraft> | undefined {
    return this.pipeline;
  }

  getGroups(): FilterGroup[] {
    return Array.from(this.groups.values()).map((group) => ({
      id: group.id,
      fields: [...group.fields],
    }));
  }

  registerDataShard<TSlice = any>(options: DataShardOptions<TDraft, TSlice>): DataShardHandle<TSlice> {
    const { id, selector, projector = defaultShardProjector, immediate = true } = options;
    if (!id) {
      throw new FilterError(ERROR_CODES.SHARD_NOT_FOUND, 'Data shard id is required');
    }

    this.disposeShard(id);

    const listeners = new Set<(value: TSlice) => void>();
    let snapshot = cloneDeep(selector({ draft: this.draft, applied: this.applied }));

    const notify = (value: TSlice) => {
      for (const listener of listeners) {
        listener(cloneDeep(value));
      }
    };

    const unsubscribe = this.subscribe((state) => {
      const next = cloneDeep(selector({ draft: state.draft, applied: state.applied }));
      if (!isEqual(next, snapshot)) {
        snapshot = cloneDeep(next);
        notify(snapshot);
      }
    });

    const record: DataShardRecord<TSlice> = {
      snapshot,
      selector: selector as any,
      projector: projector as any,
      listeners,
      unsubscribe,
    };
    this.shards.set(id, record);

    const handle: DataShardHandle<TSlice> = {
      id,
      getSnapshot: () => cloneDeep(snapshot),
      setSnapshot: (next) => {
        snapshot = cloneDeep(next);
        projector(this, cloneDeep(next));
      },
      subscribe: (listener) => {
        listeners.add(listener);
        if (immediate) {
          listener(cloneDeep(snapshot));
        }
        return () => {
          listeners.delete(listener);
        };
      },
      dispose: () => {
        this.disposeShard(id);
      },
    };

    if (immediate) {
      notify(snapshot);
    }

    return handle;
  }

  getPluginState<TState = unknown>(key: string | symbol): TState | undefined {
    return this.pluginState.get(key) as TState | undefined;
  }

  setPluginState<TState = unknown>(key: string | symbol, value: TState | undefined): void {
    if (value === undefined) {
      this.pluginState.delete(key);
      return;
    }
    this.pluginState.set(key, value);
  }

  private setupFormEffects() {
    this.form.addEffects('filter-controller', (form) => {
      form.onFormValuesChange(() => {
        const previous = this.draft;
        this.draft = cloneDeep(form.values as TDraft);
        this.listeners?.onDraftChange?.(this.draft, previous);
        this.broadcast();
      });
      form.onFieldValueChange('*', (field) => {
        const prev = field.modified ? field.modifiedValue : field.initialValue;
        this.listeners?.onFieldChange?.(field.path?.toString() ?? '', field.value, prev);
      });
    });
  }

  private broadcast() {
    this.subscribers.forEach((listener) => listener({ draft: this.draft, applied: this.applied }));
  }

  private async runPluginsInit(): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.onInit === 'function') {
        await plugin.onInit({ root: this });
      }
    }
  }

  private async runPluginsAfterApply(payload: { draft: TDraft; payload: any }): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.onAfterApply === 'function') {
        await plugin.onAfterApply({ root: this, ...payload });
      }
    }
  }

  private async runPluginsSchemaChange(
    prev: RegisteredSchema<TDraft>,
    next: RegisteredSchema<TDraft>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.onSchemaChange === 'function') {
        await plugin.onSchemaChange({ root: this, prev, next });
      }
    }
  }

  private updateDraftFromForm() {
    this.draft = cloneDeep(this.form.values as TDraft);
    this.broadcast();
  }

  private installSchema(registrar: SchemaRegistrar<TDraft>, mode: 'preserve' | 'reset') {
    const nextSchema = registrar.registerSchema({
      external: this.optionsConfig.external,
      sections: this.optionsConfig.sections,
    });
    const compiled = compileSchema(nextSchema.schema, this.form, {
      strict: this.strict,
    });

    const previousSchema = this.schema;
    this.state.registrar = registrar;
    this.schema = { ...nextSchema, schema: compiled.schema };
    registrar.afterRegister?.({ root: this, schema: this.schema });
    registrar.registerOptions?.({ root: this, schema: this.schema });

    this.setGroups(extractGroups(this.schema, this.optionsConfig));

    if (mode === 'reset') {
      this.form.setValues(cloneDeep(this.defaultValues));
      this.updateDraftFromForm();
    }

    if (previousSchema) {
      void this.runPluginsSchemaChange(previousSchema, this.schema);
    }

    this.listeners?.onSchemaLoaded?.({ root: this, schema: this.schema });
  }

  private getSourceByMode(mode: 'initial' | 'default' | 'applied'): TDraft {
    if (mode === 'applied') {
      return cloneDeep(this.state.appliedDraft ?? this.defaultValues);
    }
    if (mode === 'initial') {
      return cloneDeep(this.defaultValues);
    }
    return cloneDeep(this.defaultValues);
  }

  private resetGroup(id: string, mode: 'initial' | 'default' | 'applied') {
    const fields = this.getGroupFields(id);
    const source = this.getSourceByMode(mode);
    for (const fieldPath of fields) {
      const value = readAtPath(source, fieldPath);
      this.form.setFieldValue(fieldPath, cloneDeep(value));
    }
    this.updateDraftFromForm();
  }

  private getGroupFields(id: string): string[] {
    const group = this.groups.get(id);
    if (!group) {
      throw new FilterError(ERROR_CODES.GROUP_NOT_FOUND, `Group ${id} is not registered`);
    }
    return group.fields;
  }

  private setGroups(groups?: FilterGroup[] | undefined) {
    this.groups.clear();
    if (!groups || groups.length === 0) {
      return;
    }
    for (const group of groups) {
      const uniqueFields = Array.from(new Set(group.fields)).filter(Boolean);
      this.groups.set(group.id, { id: group.id, fields: uniqueFields });
    }
  }

  private disposeShard(id: string) {
    const existing = this.shards.get(id);
    if (existing) {
      existing.unsubscribe();
      existing.listeners.clear();
      this.shards.delete(id);
    }
  }
}

function readAtPath(source: any, path: string): any {
  if (!path) return source;
  return path.split('.').reduce((acc, key) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    return acc[key as keyof typeof acc];
  }, source);
}

function resolveMode(
  input: string | undefined,
  fallback: 'initial' | 'default' | 'applied'
): 'initial' | 'default' | 'applied' {
  if (input === 'initial' || input === 'default' || input === 'applied') {
    return input;
  }
  return fallback;
}

function ensureGroupId(id?: string): string {
  if (!id) {
    throw new FilterError(ERROR_CODES.GROUP_NOT_FOUND, 'Group id is required for group operations');
  }
  return id;
}

function convertSectionsToGroups(
  sections?: Array<{ id: string; fields?: string[] }>
): FilterGroup[] | undefined {
  if (!sections) return undefined;
  return sections.map((section) => ({ id: section.id, fields: section.fields ?? [] }));
}

function extractGroups<TDraft>(
  schema: RegisteredSchema<TDraft> | undefined,
  options: FilterOptions<TDraft>
): FilterGroup[] | undefined {
  const fromSchema = Array.isArray(schema?.meta?.groups)
    ? (schema?.meta?.groups as Array<{ id: string; fields?: string[] }>).map((group) => ({
        id: group.id,
        fields: group.fields ?? [],
      }))
    : undefined;
  if (fromSchema && fromSchema.length > 0) {
    return fromSchema;
  }
  if (options.groups && options.groups.length > 0) {
    return options.groups;
  }
  return convertSectionsToGroups(options.sections);
}

function defaultShardProjector(root: FilterApi<any>, slice: any) {
  root.load(slice, { mode: 'merge', decode: false });
}
