import type { Form, GeneralField } from '@formily/core';
import type { ISchema } from '@formily/json-schema';
import type { ReactNode } from 'react';

export type Draft = Record<string, any>;
export type JsonRecord = Record<string, any>;

export type QueryKey = ReadonlyArray<unknown>;

export interface OptionItem {
  label: string;
  value: any;
  [key: string]: any;
}

export interface OptionSource {
  key: QueryKey;
  fetcher: (ctx: { keyword?: string; draft: Draft }) => Promise<OptionItem[]>;
  enabled?: boolean | ((draft: Draft) => boolean);
  staleTime?: number;
  refetchOnMount?: boolean;
  placeholderData?: OptionItem[];
}

export interface OptionsResult {
  data: OptionItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

export interface SectionConfig {
  id: string;
  eager?: boolean;
  fields?: string[];
}

export interface FilterGroup {
  id: string;
  fields: string[];
}

export interface RegisteredSchema<TDraft = Draft> {
  name: string;
  schema: ISchema;
  meta?: Record<string, any>;
}

export interface SchemaRegistrar<TDraft = Draft> {
  name: string;
  registerSchema(args: { external?: JsonRecord; sections?: SectionConfig[] }): RegisteredSchema<TDraft>;
  afterRegister?(args: { root: FilterApi<TDraft>; schema: RegisteredSchema<TDraft> }): void;
  registerOptions?(args: { root: FilterApi<TDraft>; schema: RegisteredSchema<TDraft> }): void;
}

export interface TransformContext<TDraft = Draft> {
  root: FilterApi<TDraft>;
  schema?: RegisteredSchema<TDraft>;
}

export interface DataShardOptions<TDraft = Draft, TSlice = any> {
  id: string;
  selector: (state: { draft: TDraft; applied?: TDraft }) => TSlice;
  projector?: (root: FilterApi<TDraft>, slice: TSlice) => void;
  source?: 'draft' | 'applied';
  immediate?: boolean;
}

export interface DataShardHandle<TSlice = any> {
  id: string;
  getSnapshot(): TSlice;
  setSnapshot(next: TSlice): void;
  subscribe(listener: (value: TSlice) => void): () => void;
  dispose(): void;
}

export interface PipelineStage<TDraft = Draft, TPayload = any> {
  name: string;
  encode?: (input: TPayload, ctx: TransformContext<TDraft>) => TPayload;
  decode?: (input: TPayload, ctx: TransformContext<TDraft>) => TPayload;
}

export interface DataPipeline<TDraft = Draft> {
  encode(input: TDraft, ctx: TransformContext<TDraft>): any;
  decode(input: any, ctx: TransformContext<TDraft>): TDraft;
  extend(stage: PipelineStage<TDraft>): DataPipeline<TDraft>;
}

export interface Plugin<TDraft = Draft> {
  name: string;
  onInit?(ctx: { root: FilterApi<TDraft> }): void | Promise<void>;
  onAfterApply?(ctx: { root: FilterApi<TDraft>; payload: any; draft: TDraft }): void | Promise<void>;
  onSchemaChange?(ctx: { root: FilterApi<TDraft>; prev?: RegisteredSchema<TDraft>; next: RegisteredSchema<TDraft> }):
    | void
    | Promise<void>;
  onDestroy?(ctx: { root: FilterApi<TDraft> }): void | Promise<void>;
}

export interface FilterListeners<TDraft = Draft> {
  onInit?(ctx: { root: FilterApi<TDraft> }): void;
  onSchemaLoaded?(ctx: { root: FilterApi<TDraft>; schema: RegisteredSchema<TDraft> }): void;
  onDraftChange?(draft: TDraft, prev: TDraft): void;
  onFieldChange?(path: string, value: any, prev: any): void;
  onApplyStart?(ctx: { draft: TDraft }): void;
  onApplySuccess?(ctx: { draft: TDraft; payload: any }): void;
  onApplyError?(err: unknown): void;
  onReset?(ctx: { scope: 'all' | 'field' | 'group'; target?: string }): void;
  onDestroy?(ctx: { root: FilterApi<TDraft> }): void;
}

export interface FilterOptions<TDraft = Draft> {
  defaultValues?: TDraft;
  schemaRegistrar?: SchemaRegistrar<TDraft>;
  external?: JsonRecord;
  sections?: SectionConfig[];
  listeners?: FilterListeners<TDraft>;
  plugins?: Plugin<TDraft>[];
  transform?: (input: TDraft, ctx: TransformContext<TDraft>) => any;
  pipeline?: DataPipeline<TDraft>;
  strict?: boolean;
  applyDebounceMs?: number;
  groups?: FilterGroup[];
}

export interface FieldSnapshot {
  value: any;
  initialValue: any;
  displayed: boolean;
  disabled: boolean;
  validating: boolean;
  errors: string[];
  touched: boolean;
}

export interface FieldApi {
  name: string;
  value: any;
  error?: string;
  validating: boolean;
  visible: boolean;
  disabled: boolean;
  touched: boolean;
  setValue(value: any, opts?: { silent?: boolean }): void;
  reset(mode?: 'initial' | 'default' | 'applied'): void;
  validate(): Promise<void>;
  getState(): FieldSnapshot;
  setState(cb: (field: GeneralField) => void): void;
}

export interface HeadlessRootOptions<TDraft = Draft, TRoot = TDraft> {
  id?: string;
  selector?: (draft: TDraft) => TRoot;
  apply?: (root: FilterApi<TDraft>, next: TRoot) => void;
  immediate?: boolean;
}

export interface HeadlessRoot<TRoot = Draft> {
  id: string;
  getSnapshot(): TRoot;
  setSnapshot(next: TRoot): void;
  subscribe(listener: (value: TRoot) => void): () => void;
  dispose(): void;
}

export interface LoadOptions<TDraft = Draft> {
  mode?: 'replace' | 'merge';
  decode?: boolean;
}

export interface FilterApi<TDraft = Draft> {
  readonly id: string;
  readonly form: Form;
  readonly schema?: RegisteredSchema<TDraft>;
  draft: TDraft;
  applied?: TDraft;
  validating: boolean;

  apply(): Promise<void>;
  reset(scope?: 'all' | 'group' | string, target?: string): void;
  resetValue(scope?: 'all' | 'group' | string, target?: string, mode?: 'initial' | 'default' | 'applied'): void;
  clearErrors(scope?: 'all' | 'group' | string, target?: string): void;
  validateAll(): Promise<void>;
  registerOptionSource(path: string, source: OptionSource): void;
  removeOptionSource(path: string): void;
  getOptionSource(path: string): OptionSource | undefined;
  getField(path: string): FieldApi;
  subscribe(listener: (state: { draft: TDraft; applied?: TDraft }) => void): () => void;
  setSchemaRegistrar(registrar: SchemaRegistrar<TDraft>, mode?: 'preserve' | 'reset'): void;
  createHeadlessRoot<TRoot = TDraft>(options?: HeadlessRootOptions<TDraft, TRoot>): HeadlessRoot<TRoot>;
  load(values: Partial<TDraft>, options?: LoadOptions<TDraft>): void;
  getPipeline(): DataPipeline<TDraft> | undefined;
  getGroups(): FilterGroup[];
  registerDataShard<TSlice = any>(options: DataShardOptions<TDraft, TSlice>): DataShardHandle<TSlice>;
  getPluginState<TState = unknown>(key: string | symbol): TState | undefined;
  setPluginState<TState = unknown>(key: string | symbol, value: TState | undefined): void;
}

export interface GlobalDefaults<TDraft = Draft> {
  plugins?: Plugin<TDraft>[];
  listeners?: FilterListeners<TDraft>;
  transform?: (input: TDraft, ctx: TransformContext<TDraft>) => any;
  pipeline?: DataPipeline<TDraft>;
  strict?: boolean;
  applyDebounceMs?: number;
  groups?: FilterGroup[];
}

export interface InstanceRegistry<TDraft = Draft> {
  setDefault(instance: FilterApi<TDraft>): void;
  getDefault(): FilterApi<TDraft> | undefined;
  set(namespace: string, instance: FilterApi<TDraft>): void;
  get(namespace: string): FilterApi<TDraft> | undefined;
  delete(namespace: string): void;
  keys(): string[];
}

export interface FilterConfigureValue<TDraft = Draft> {
  defaults?: GlobalDefaults<TDraft>;
  registry?: InstanceRegistry<TDraft>;
  mergeStrategy?: {
    plugins?: 'prepend' | 'append';
    listeners?: 'shallow' | 'deep';
  };
}

export interface FilterConfigureProps<TDraft = Draft> {
  value: FilterConfigureValue<TDraft>;
  children?: ReactNode;
}

export interface FilterProviderProps<TDraft = Draft> {
  instance: FilterApi<TDraft>;
  namespace?: string;
  children?: ReactNode;
}

export interface UseFilterInput<TDraft = Draft> {
  instance?: FilterApi<TDraft>;
  namespace?: string;
}

export interface UseFieldOptions<TDraft = Draft> {
  instance?: FilterApi<TDraft>;
  namespace?: string;
}

export interface UseOptionsInput<TDraft = Draft> extends UseFilterInput<TDraft> {
  path: string;
  keyword?: string;
}

export interface FilterPreset<TDraft = Draft> {
  id: string;
  name: string;
  values: TDraft;
  metadata?: JsonRecord;
  updatedAt: number;
}

export interface PresetStorage<TDraft = Draft> {
  list(namespace: string): FilterPreset<TDraft>[];
  get(namespace: string, id: string): FilterPreset<TDraft> | undefined;
  save(namespace: string, preset: FilterPreset<TDraft>): void;
  remove(namespace: string, id: string): void;
  subscribe?(namespace: string, listener: () => void): () => void;
}

export interface PresetPluginState<TDraft = Draft> {
  storage: PresetStorage<TDraft>;
  namespace: string;
  key: string | symbol;
}

export interface PresetPluginOptions<TDraft = Draft> {
  storage?: PresetStorage<TDraft>;
  namespace?: string;
  key?: string | symbol;
  initialPresets?: FilterPreset<TDraft>[];
}

export interface UseFilterPresetsOptions<TDraft = Draft> extends UseFilterInput<TDraft> {
  pluginKey?: string | symbol;
  onApply?(preset: FilterPreset<TDraft>): void;
}

export interface UseFilterPresetsResult<TDraft = Draft> {
  presets: FilterPreset<TDraft>[];
  savePreset(name: string, metadata?: JsonRecord): FilterPreset<TDraft>;
  applyPreset(id: string): Promise<void>;
  removePreset(id: string): void;
  renamePreset(id: string, name: string): void;
  overwritePreset(id: string, updater: Partial<FilterPreset<TDraft>>): FilterPreset<TDraft> | undefined;
}
