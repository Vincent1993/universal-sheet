import type { Form, GeneralField } from '@formily/core';
import type { FieldApi, FieldSnapshot } from './types.js';

export function readFieldSnapshot(form: Form, path: string): FieldSnapshot {
  let snapshot: FieldSnapshot = {
    value: undefined,
    initialValue: undefined,
    displayed: true,
    disabled: false,
    validating: false,
    errors: [],
    touched: false,
  };

  form.setFieldState(path, (field: GeneralField) => {
    snapshot = {
      value: field.value,
      initialValue: field.initialValue,
      displayed: field.display !== 'none' && field.visible !== false,
      disabled: Boolean(field.disabled || field.pattern === 'readPretty'),
      validating: Boolean(field.validating || field.loading),
      errors: normalizeErrors(field.selfErrors ?? field.errors ?? []),
      touched: Boolean(field.visited || field.touched || field.mounted),
    };
  });

  return snapshot;
}

export function normalizeErrors(errors: any[]): string[] {
  return errors.map((err) => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (Array.isArray(err)) return err.join(', ');
    if (err.message) return String(err.message);
    return String(err);
  });
}

export function createFieldApi(form: Form, path: string, reset: (mode?: 'initial' | 'default' | 'applied') => void): FieldApi {
  return {
    name: path,
    get value() {
      return readFieldSnapshot(form, path).value;
    },
    get error() {
      return readFieldSnapshot(form, path).errors[0];
    },
    get validating() {
      return readFieldSnapshot(form, path).validating;
    },
    get visible() {
      return readFieldSnapshot(form, path).displayed;
    },
    get disabled() {
      return readFieldSnapshot(form, path).disabled;
    },
    get touched() {
      return readFieldSnapshot(form, path).touched;
    },
    setValue(value: any) {
      form.setFieldValue(path, value);
    },
    reset(mode = 'default') {
      reset(mode);
    },
    async validate() {
      await form.validate(path);
    },
    getState() {
      return readFieldSnapshot(form, path);
    },
    setState(cb) {
      form.setFieldState(path, cb);
    },
  };
}
