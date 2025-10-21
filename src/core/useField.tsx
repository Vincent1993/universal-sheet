import { useEffect, useMemo, useState } from 'react';
import { useFilter } from './FilterProvider.js';
import { readFieldSnapshot } from './fieldHelpers.js';
import type { FieldApi, FieldSnapshot, UseFieldOptions } from './types.js';

export function useField(path: string, options?: UseFieldOptions): FieldApi {
  const filter = useFilter(options);
  const form = filter.form as any;

  const readSnapshot = () => readFieldSnapshot(form, path);
  const [snapshot, setSnapshot] = useState<FieldSnapshot>(readSnapshot);

  useEffect(() => {
    setSnapshot(readSnapshot());
    const disposers = [
      form.onFieldValueChange(path, () => setSnapshot(readSnapshot())),
      form.onFieldInitialValueChange?.(path, () => setSnapshot(readSnapshot())),
      form.onFieldInputValueChange?.(path, () => setSnapshot(readSnapshot())),
    ].filter(Boolean);
    return () => {
      disposers.forEach((dispose: () => void) => dispose());
    };
  }, [form, path]);

  const api = useMemo<FieldApi>(() => {
    return {
      name: path,
      get value() {
        return snapshot.value;
      },
      get error() {
        return snapshot.errors[0];
      },
      get validating() {
        return snapshot.validating;
      },
      get visible() {
        return snapshot.displayed;
      },
      get disabled() {
        return snapshot.disabled;
      },
      get touched() {
        return snapshot.touched;
      },
      setValue: (value: any) => {
        form.setFieldValue(path, value);
      },
      reset(mode = 'default') {
        filter.resetValue(path, mode);
      },
      async validate() {
        await form.validate(path);
      },
      getState() {
        return readFieldSnapshot(form, path);
      },
      setState(cb) {
        form.setFieldState(path, cb);
        setSnapshot(readFieldSnapshot(form, path));
      },
    };
  }, [filter, form, path, snapshot]);

  return api;
}

