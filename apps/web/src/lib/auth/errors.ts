export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor(message = "Tenant access required.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
