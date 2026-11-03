export class AdapterError extends Error {
  public readonly code: string;
  public readonly adapterId?: string;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    options?: { adapterId?: string; details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AdapterError';
    this.code = code;
    this.adapterId = options?.adapterId;
    this.details = options?.details;
  }
}

export class AdapterNotFoundError extends AdapterError {
  constructor(adapterId: string, availableIds: readonly string[] = []) {
    const list = availableIds.length > 0 ? ` Available adapters: ${availableIds.join(', ')}.` : '';
    super('ADAPTER_NOT_FOUND', `Adapter "${adapterId}" not found.${list}`, { adapterId });
    this.name = 'AdapterNotFoundError';
  }
}

export class DuplicateAdapterError extends AdapterError {
  constructor(adapterId: string) {
    super(
      'DUPLICATE_ADAPTER',
      `Adapter with id "${adapterId}" is already registered. Pass { replace: true } to override.`,
      { adapterId },
    );
    this.name = 'DuplicateAdapterError';
  }
}

export class AdapterParsingError extends AdapterError {
  public readonly rawInput?: string;
  public readonly lineNumber?: number;

  constructor(
    message: string,
    options?: { adapterId?: string; rawInput?: string; lineNumber?: number; cause?: unknown },
  ) {
    super('ADAPTER_PARSING_ERROR', message, options);
    this.name = 'AdapterParsingError';
    this.rawInput = options?.rawInput;
    this.lineNumber = options?.lineNumber;
  }
}

export class AdapterValidationError extends AdapterError {
  public readonly issues?: unknown[];

  constructor(
    message: string,
    options?: { adapterId?: string; issues?: unknown[]; cause?: unknown },
  ) {
    super('ADAPTER_VALIDATION_ERROR', message, options);
    this.name = 'AdapterValidationError';
    this.issues = options?.issues;
  }
}

export class AdapterSessionError extends AdapterError {
  public readonly sessionId?: string;

  constructor(
    message: string,
    options?: { adapterId?: string; sessionId?: string; cause?: unknown },
  ) {
    super('ADAPTER_SESSION_ERROR', message, options);
    this.name = 'AdapterSessionError';
    this.sessionId = options?.sessionId;
  }
}
