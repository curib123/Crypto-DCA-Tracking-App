export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function asString(value: unknown, name: string, max = 500) {
  if (typeof value !== "string") throw new HttpError(400, name + " must be a string.");
  const clean = value.trim();
  if (!clean) throw new HttpError(400, name + " is required.");
  if (clean.length > max) throw new HttpError(400, name + " is too long.");
  return clean;
}

export function optionalString(value: unknown, max = 500) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "Invalid text value.");
  const clean = value.trim();
  if (clean.length > max) throw new HttpError(400, "Text value is too long.");
  return clean || null;
}

export function asNumber(value: unknown, name: string, min = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw new HttpError(400, name + " must be a number greater than or equal to " + min + ".");
  }
  return number;
}
