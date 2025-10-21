declare module 'es-toolkit/clone-deep' {
  export function cloneDeep<T>(value: T): T;
}

declare module 'es-toolkit/merge' {
  export function merge<T extends object, S extends object>(target: T, source: S): T & S;
}

declare module 'es-toolkit/is-equal' {
  export function isEqual<T>(a: T, b: T): boolean;
}
