export class IdentityError extends Error {
  constructor(
    public readonly code:
      | 'EMAIL_UNAVAILABLE'
      | 'INVALID_CREDENTIALS'
      | 'INVALID_RESET_TOKEN'
      | 'IDENTITY_CONFIGURATION_ERROR',
  ) {
    super(code);
    this.name = 'IdentityError';
  }
}
