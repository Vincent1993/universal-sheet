declare module 'react' {
  export as namespace React;
  export type ReactNode = any;
  export namespace React {
    type ReactNode = any;
  }
  export interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => any;
  }
  export function createContext<T>(defaultValue: T): Context<T> & { _currentValue?: T };
  export function useContext<T>(context: Context<T>): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useState<T>(initial: T | (() => T)): [T, (value: T) => void];
  export function useRef<T>(initial: T): { current: T };
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly any[]): T;
  export function useSyncExternalStore<T>(
    subscribe: (listener: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T
  ): T;
  export type JSXElementConstructor<P> = (props: P) => any;
  export interface FunctionComponent<P = {}> {
    (props: P): any;
  }
  export type JSXElement = any;
  export type FC<P = {}> = FunctionComponent<P>;
  export type PropsWithChildren<P> = P & { children?: ReactNode };
  namespace JSX {
    interface Element {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
  const React: {
    createElement: (...args: any[]) => any;
  };
  export default React;
}
