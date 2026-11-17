/**
 * In-memory rate limiter per Telegram User ID menggunakan sliding window.
 */
export class RateLimiter {
  private userRequests: Map<number, number[]> = new Map();
  private readonly windowMs: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 60000) {
    this.windowMs = windowMs;

    // Bersihkan data user yang sudah expired setiap 5 menit agar hemat memori
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Unref agar timer ini tidak menghalangi proses keluar saat shutdown
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Mengecek apakah user terkena rate limit
   * @param userId Telegram User ID
   * @param maxRequests Maksimal request dalam 1 window (default: RATE_LIMIT_PER_MINUTE)
   * @returns object { limited: boolean, retryAfterSeconds: number }
   */
  check(userId: number, maxRequests: number): { limited: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const timestamps = this.userRequests.get(userId) || [];

    // Filter timestamp hanya dalam rentang window terakhir
    const validTimestamps = timestamps.filter((time) => now - time < this.windowMs);

    if (validTimestamps.length >= maxRequests) {
      const oldestTime = validTimestamps[0];
      const retryAfterMs = this.windowMs - (now - oldestTime);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return { limited: true, retryAfterSeconds };
    }

    // Catat request baru
    validTimestamps.push(now);
    this.userRequests.set(userId, validTimestamps);

    return { limited: false, retryAfterSeconds: 0 };
  }

  /**
   * Hapus riwayat user tertentu (misal saat /reset jika diinginkan)
   */
  reset(userId: number): void {
    this.userRequests.delete(userId);
  }

  /**
   * Membersihkan data yang sudah tidak aktif
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [userId, timestamps] of this.userRequests.entries()) {
      const valid = timestamps.filter((time) => now - time < this.windowMs);
      if (valid.length === 0) {
        this.userRequests.delete(userId);
      } else {
        this.userRequests.set(userId, valid);
      }
    }
  }

  /**
   * Hentikan timer background saat shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.userRequests.clear();
  }
}
