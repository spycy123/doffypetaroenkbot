import { RateLimiter } from '../src/utils/rateLimit';

console.log('Testing RateLimiter...');

const limiter = new RateLimiter(60000);
const userId = 12345;
const maxRequests = 3;

// 3 request pertama harus berhasil
for (let i = 1; i <= 3; i++) {
  const result = limiter.check(userId, maxRequests);
  console.log(`Req ${i}: limited=${result.limited}`);
  if (result.limited) {
    console.error('FAIL: Seharusnya belum limited');
  }
}

// Request ke-4 harus kena rate limit
const fourth = limiter.check(userId, maxRequests);
console.log(`Req 4: limited=${fourth.limited}, retryAfter=${fourth.retryAfterSeconds}s`);
if (!fourth.limited) {
  console.error('FAIL: Seharusnya kena rate limit');
} else {
  console.log('PASS: Rate limit berhasil memblokir request berlebih');
}

limiter.destroy();
