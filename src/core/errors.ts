export const ERROR_CODES = {
  NO_FILTER_CONTEXT: 'E_NO_FILTER_CONTEXT',
  NAMESPACE_NOT_FOUND: 'E_NAMESPACE_NOT_FOUND',
  CONFIG_INVALID: 'E_CONFIG_INVALID',
  SCHEMA_NOT_READY: 'E_SCHEMA_NOT_READY',
  STRICT_WRITE: 'E_STRICT_WRITE',
  APPLY_VALIDATION_FAILED: 'E_APPLY_VALIDATION_FAILED',
  CODEC_ENCODE_FAILED: 'E_CODEC_ENCODE_FAILED',
  CODEC_DECODE_FAILED: 'E_CODEC_DECODE_FAILED',
  PLUGIN_ERROR: 'E_PLUGIN_ERROR',
  GROUP_NOT_FOUND: 'E_GROUP_NOT_FOUND',
  SHARD_NOT_FOUND: 'E_SHARD_NOT_FOUND',
  PLUGIN_STATE_NOT_READY: 'E_PLUGIN_STATE_NOT_READY'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class FilterError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'FilterError';
  }
}

export function isFilterError(value: unknown): value is FilterError {
  return value instanceof FilterError;
}
