export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  factor?: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Mengecek apakah error bersifat sementara (rate limit 429 atau server error 5xx)
 * sehingga layak untuk dicoba ulang secara otomatis.
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode || error.response?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)) {
    return true;
  }

  const msg = String(error.message || '').toLowerCase();
  if (
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network error') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504')
  ) {
    return true;
  }

  return false;
}

/**
 * Menjalankan fungsi asynchronous dengan exponential backoff retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const factor = options.factor ?? 2;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(factor, attempt - 1);
      if (options.onRetry) {
        options.onRetry(error, attempt, delayMs);
      } else {
        console.warn(
          `[RETRY] Terjadi error sementara (${error?.status || error?.code || error?.message}). Mencoba ulang (${attempt}/${maxRetries}) setelah ${delayMs}ms...`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
