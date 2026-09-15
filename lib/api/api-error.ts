import type { AxiosError } from "axios";

export class ApiError extends Error {
  readonly status?: number;
  readonly original?: AxiosError;

  constructor(message: string, status?: number, original?: AxiosError) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.original = original;
  }
}
