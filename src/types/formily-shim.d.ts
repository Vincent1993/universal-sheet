declare module '@formily/core' {
  export interface GeneralField {
    value: any;
    initialValue: any;
    display?: string;
    visible?: boolean;
    disabled?: boolean;
    pattern?: string;
    validating?: boolean;
    loading?: boolean;
    selfErrors?: Array<string | { message?: string }>;
    errors?: Array<string | { message?: string }>;
    visited?: boolean;
    touched?: boolean;
    mounted?: boolean;
    modified?: boolean;
    modifiedValue?: any;
    path?: { toString(): string };
  }

  export interface Form {
    values: any;
    setValues(values: any): void;
    validate(pattern?: string): Promise<void>;
    setFieldValue(path: string, value: any): void;
    setFieldState(path: string, cb: (field: GeneralField) => void): void;
    setFormState(cb: (state: any) => void): void;
    addEffects(id: string, cb: (form: Form) => void): void;
    onFormValuesChange(cb: () => void): () => void;
    onFieldValueChange(pattern: string, cb: (field: GeneralField) => void): () => void;
    onFieldInitialValueChange?(pattern: string, cb: (field: GeneralField) => void): () => void;
    onFieldInputValueChange?(pattern: string, cb: (field: GeneralField) => void): () => void;
  }

  export function createForm(options?: { values?: any }): Form;
}

declare module '@formily/react' {
  import type { Form } from '@formily/core';
  import type React from 'react';
  export interface FormProviderProps {
    form: Form;
    children?: React.ReactNode;
  }
  export const FormProvider: React.FC<FormProviderProps>;
}

declare module '@formily/json-schema' {
  export interface ISchema {
    type?: string;
    properties?: Record<string, ISchema>;
    items?: ISchema | ISchema[];
    ['x-component']?: string;
    [key: string]: any;
  }
}
