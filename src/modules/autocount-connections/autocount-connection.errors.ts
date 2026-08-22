export type AutocountConnectionErrorReason =
  'NOT_CONFIGURED' | 'AUTH_FAILED' | 'UNREACHABLE' | 'UNKNOWN';

export class AutocountConnectionError extends Error {
  constructor(
    public readonly organizationId: number,
    public readonly reason: AutocountConnectionErrorReason,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AutocountConnectionError';
  }
}
