import type { PayloadRequest } from 'payload'

/**
 * True for draft saves and autosaves (`?draft=true`). They only write a new
 * version; the published document — what the website and counts use — is
 * untouched, so public-facing side effects can be skipped.
 */
export const isDraftSave = (req: PayloadRequest) => {
  const q = req.query as Record<string, unknown> | undefined
  return q?.draft === 'true' || q?.draft === true || q?.autosave === 'true' || q?.autosave === true
}
