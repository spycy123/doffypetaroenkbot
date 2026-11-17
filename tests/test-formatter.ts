import { markdownToTelegramHtml, escapeHtml } from '../src/utils/formatTelegram';

console.log('Testing markdownToTelegramHtml...');

const input = `
# Tutorial Singkat: Looping
Halo **teman-teman**! Hari ini kita belajar *for-loop* di TypeScript.
Berikut contoh operator perbandingan: a < b && b > 0.

\`\`\`typescript
for (let i = 0; i < 5; i++) {
  console.log("Nilai i:", i);
}
\`\`\`

Gunakan fungsi \`Array.map()\` untuk iterasi array.
Kunjungi juga [Dokumentasi Resmi](https://www.typescriptlang.org) untuk info lebih lanjut.
- Pahami sintaks dasar
- Latihan soal
`;

const formatted = markdownToTelegramHtml(input);
console.log('--- Hasil Formatting HTML ---');
console.log(formatted);
console.log('--- Selesai ---');

// Verifikasi tag dasar
console.log('Contains <b>:', formatted.includes('<b>'));
console.log('Contains <pre><code:', formatted.includes('<pre><code'));
console.log('Contains &lt; inside code:', formatted.includes('i &lt; 5'));
console.log('Contains &amp;&amp;:', formatted.includes('&amp;&amp;'));
