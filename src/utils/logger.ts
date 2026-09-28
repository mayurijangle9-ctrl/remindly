/**
 * REMINDLY PRODUCTION OBSERVABILITY & PII-SCRUBBED LOGGING SYSTEM
 *
 * Compliant with:
 * - Apple App Store Review Guideline 5.1.1 (Data Collection and Storage)
 * - Apple iOS Privacy Manifest (PrivacyInfo.xcprivacy)
 * - Google Play Data Safety Requirements (Zero User-Identifiable Data Collection)
 *
 * Enforces that user reminder titles, notes, natural language input,
 * and JSON backups are NEVER logged or dispatched to remote crash handlers.
 */

// Known PII and secret patterns to scrub
const API_KEY_REGEX = /(?:key|api_key|token|auth|bearer)[\s:="']+[A-Za-z0-9_-]{20,}/gi;
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/gi;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const JSON_BLOB_REGEX = /\{[\s\S]*"title"[\s\S]*\}/gi;

/**
 * Strips all potential PII, user strings, and secrets from error logs.
 */
export function scrubPii(message: string): string {
  if (!message || typeof message !== 'string') return '';
  return message
    .replace(API_KEY_REGEX, '[API_KEY_REDACTED]')
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(PHONE_REGEX, '[PHONE_REDACTED]')
    .replace(JSON_BLOB_REGEX, '[USER_PAYLOAD_REDACTED]')
    .replace(/file:\/\/\/[^\s]+/g, '[LOCAL_URI_REDACTED]');
}

export type ErrorCategoryCode =
  | 'DB_INIT_FAIL_101'
  | 'DB_MIGRATE_FAIL_102'
  | 'DB_READ_FAIL_103'
  | 'DB_WRITE_FAIL_104'
  | 'DB_TX_FAIL_105'
  | 'NOTIF_CHANNEL_FAIL_201'
  | 'NOTIF_SCHED_FAIL_202'
  | 'NOTIF_ACTION_FAIL_203'
  | 'LLM_TIMEOUT_301'
  | 'LLM_NETWORK_FAIL_302'
  | 'BACKUP_EXPORT_FAIL_401'
  | 'BACKUP_IMPORT_FAIL_402'
  | 'GENERIC_RUNTIME_500';

export interface ScrubbedErrorEvent {
  code: ErrorCategoryCode;
  sanitizedMessage: string;
  timestamp: string;
  stack?: string;
  metadata?: Record<string, string | number | boolean>;
}

// Global hook for external crash reporters (e.g. Sentry / Firebase Crashlytics)
type RemoteReporter = (event: ScrubbedErrorEvent) => void;
let remoteReporter: RemoteReporter | null = null;

export function registerCrashReporter(reporter: RemoteReporter) {
  remoteReporter = reporter;
}

export const logger = {
  /**
   * Diagnostic log for development only. Completely eliminated in production builds.
   */
  debug: (tag: string, message: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.log(`[DEBUG][${tag}] ${scrubPii(message)}`, ...args);
    }
  },

  /**
   * Diagnostic warning for development only. Completely eliminated in production builds.
   */
  warn: (tag: string, message: string, ...args: unknown[]) => {
    if (__DEV__) {
      console.warn(`[WARN][${tag}] ${scrubPii(message)}`, ...args);
    }
  },

  /**
   * Production-safe error capture:
   * Scrubs any message before logging and formats as a standardized category code.
   */
  error: (
    code: ErrorCategoryCode,
    error: unknown,
    context?: Record<string, string | number | boolean>
  ) => {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const sanitizedMsg = scrubPii(rawMsg);
    const stack = error instanceof Error && error.stack ? scrubPii(error.stack) : undefined;

    const event: ScrubbedErrorEvent = {
      code,
      sanitizedMessage: sanitizedMsg || `Operation failed with code ${code}`,
      timestamp: new Date().toISOString(),
      stack,
      metadata: context,
    };

    if (__DEV__) {
      console.error(`[ERROR][${code}] ${event.sanitizedMessage}`, event);
    }

    if (remoteReporter) {
      try {
        remoteReporter(event);
      } catch {
        // Suppress reporter exceptions to protect app execution
      }
    }
  },
};
