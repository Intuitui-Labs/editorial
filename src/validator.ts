export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{ path?: string; message: string }>;
}

export type StandardSchemaV1<Input = unknown, Output = Input> = {
  '~standard': {
    version: 1;
    vendor: string;
    validate: (
      value: unknown
    ) =>
      | { value: Output; issues?: never }
      | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }>; value?: never }
      | Promise<
          | { value: Output; issues?: never }
          | { issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }>; value?: never }
        >;
  };
};

export type CustomValidatorFn<T> = (raw: unknown) => ValidationResult<T> | T;

export type SchemaValidator<T> =
  | StandardSchemaV1<unknown, T>
  | { parse: (raw: unknown) => T }
  | { safeParse: (raw: unknown) => { success: true; data: T } | { success: false; error: { issues?: Array<{ message: string; path?: Array<string | number> }> } } }
  | CustomValidatorFn<T>;

export function resolveValidator<T>(validator?: SchemaValidator<T>): (raw: unknown) => T {
  if (!validator) {
    return (raw: unknown) => raw as T;
  }

  if (typeof validator === 'object' && validator !== null && '~standard' in validator) {
    const std = (validator as StandardSchemaV1<unknown, T>)['~standard'];
    return (raw: unknown) => {
      const result = std.validate(raw);
      if (result instanceof Promise) {
        throw new Error('Async Standard Schema validation is not supported in synchronous document parsing.');
      }
      if (result.issues && result.issues.length > 0) {
        const msg = result.issues.map((i) => i.message).join('; ');
        throw new Error('Standard Schema validation failed: ' + msg);
      }
      return result.value as T;
    };
  }

  if (typeof validator === 'object' && validator !== null && 'parse' in validator && typeof validator.parse === 'function') {
    return (raw: unknown) => validator.parse(raw);
  }

  if (typeof validator === 'object' && validator !== null && 'safeParse' in validator && typeof validator.safeParse === 'function') {
    return (raw: unknown) => {
      const result = validator.safeParse(raw);
      if (!result.success) {
        const issues = result.error?.issues;
        const msg = issues ? issues.map((i) => (i.path ? i.path.join('.') + ': ' : '') + i.message).join('; ') : 'Validation failed';
        throw new Error(msg);
      }
      return result.data;
    };
  }

  if (typeof validator === 'function') {
    return (raw: unknown) => {
      const res = (validator as CustomValidatorFn<T>)(raw);
      if (typeof res === 'object' && res !== null && 'success' in res) {
        const vResult = res as ValidationResult<T>;
        if (!vResult.success) {
          const msg = vResult.errors ? vResult.errors.map((e) => (e.path ? e.path + ': ' : '') + e.message).join('; ') : 'Validation failed';
          throw new Error(msg);
        }
        return vResult.data as T;
      }
      return res as T;
    };
  }

  throw new Error('Invalid schema validator provided. Expected Standard Schema, Zod-like parse/safeParse, or validator function.');
}

export function defaultArticleValidator(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Article metadata must be an object.');
  }

  const obj = { ...(raw as Record<string, unknown>) };
  const errors: string[] = [];

  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    errors.push('title must be a non-empty string');
  }

  if (!obj.publishDate) {
    errors.push('publishDate is required');
  } else {
    const d = new Date(String(obj.publishDate));
    if (isNaN(d.getTime())) {
      errors.push('publishDate must be a valid date or date string');
    }
  }

  if (obj.status && !['draft', 'review', 'published', 'archived'].includes(String(obj.status))) {
    errors.push("status must be one of 'draft' | 'review' | 'published' | 'archived'");
  }

  if (errors.length > 0) {
    throw new Error('Article validation failed: ' + errors.join(', '));
  }

  return {
    ...obj,
    status: obj.status || 'draft',
    workId: obj.workId || (typeof obj.title === 'string' ? obj.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 'untitled'),
  };
}
