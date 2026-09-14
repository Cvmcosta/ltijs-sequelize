import type { z } from 'zod'
import { ValidationError } from 'ltijs'

/** Mirrors `ltijs`'s own internal `validate()` util, reusing its real exported `ValidationError` so a
 * consumer can `catch (err) { if (err instanceof ValidationError) ... }` uniformly, regardless of whether
 * the error originated in `ltijs` core or in this plugin's own database read path. */
export const validate = <T>(schema: z.ZodType, value: unknown): T => {
  const result = schema.safeParse(value)
  if (!result.success) throw new ValidationError(result.error)
  return result.data as T
}
