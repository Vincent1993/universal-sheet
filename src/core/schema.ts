import type { Form } from '@formily/core';
import type { ISchema } from '@formily/json-schema';

interface CompileOptions {
  strict?: boolean;
}

export function compileSchema(schema: ISchema, form: Form, options: CompileOptions) {
  ensureFields(schema, form, options, []);
  return { schema };
}

function ensureFields(schema: ISchema, form: Form, options: CompileOptions, path: string[]) {
  if (schema.type === 'object' && schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      ensureFields(value, form, options, [...path, key]);
    }
    return;
  }

  if (schema.type === 'array' && schema.items) {
    const next = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (next) {
      ensureFields(next, form, options, [...path, '0']);
    }
    return;
  }

  const name = path.filter(Boolean).join('.');
  if (!name) {
    return;
  }

  form.setFieldState(name, (field) => field);

  if (options.strict && !schema['x-component']) {
    throw new Error(`Strict mode requires component declaration for field: ${name}`);
  }
}
