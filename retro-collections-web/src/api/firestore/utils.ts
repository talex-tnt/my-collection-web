/**
 * Safely checks if a value is a standard record object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deeply sanitizes an object payload to ensure compatibility with Firestore.
 * Strips away all keys containing 'undefined', trims strings, and ignores empty entries.
 */
export function sanitizeFirestorePayload<T>(obj: T): T {
  // Pass primitives right through
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle special Firestore field token objects without mutating them
  if (
    '_methodName' in obj ||
    (obj.constructor && obj.constructor.name === 'FieldValue')
  ) {
    return obj;
  }

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj
      .map((item: unknown) =>
        typeof item === 'object' ? sanitizeFirestorePayload(item) : item
      )
      .filter((item: unknown) => item !== undefined) as unknown as T;
  }

  // Handle Plain Objects
  if (isPlainObject(obj)) {
    const sanitized: Record<string, unknown> = {};

    Object.keys(obj).forEach((key) => {
      const value = obj[key];

      // 1. Drop undefined
      if (value === undefined) {
        return;
      }

      // 2. Handle nested objects recursively
      if (typeof value === 'object' && value !== null) {
        const nested = sanitizeFirestorePayload(value);

        if (
          (isPlainObject(value) && '_methodName' in value) ||
          (Array.isArray(nested) && nested.length > 0) ||
          (isPlainObject(nested) && Object.keys(nested).length > 0)
        ) {
          sanitized[key] = nested;
        }
        return;
      }

      // 3. Trim Strings
      if (typeof value === 'string') {
        sanitized[key] = value.trim();
        return;
      }

      // 4. Pass down numbers, booleans, null
      sanitized[key] = value;
    });

    return sanitized as T;
  }

  return obj;
}
