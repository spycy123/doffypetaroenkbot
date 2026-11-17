import { splitMessage } from '../src/utils/splitMessage';

console.log('Testing splitMessage...');

const shortText = 'Halo ini pesan pendek.';
console.log('Short test:', splitMessage(shortText).length === 1 ? 'PASS' : 'FAIL');

// Test paragraph splitting
const longParagraphs = Array(10).fill('Ini adalah paragraf penjelasan yang cukup panjang untuk menguji logika pemecahan pesan bot Telegram. ').join('\n\n');
const chunks = splitMessage(longParagraphs, 200);
console.log('Paragraph chunks count:', chunks.length);
console.log('All <= 200:', chunks.every(c => c.length <= 200) ? 'PASS' : 'FAIL');

// Test code block integrity
const codeSample = 'Pengantar:\n\n```typescript\nfunction hitung(a: number, b: number): number {\n  return a + b;\n}\n```\n\nPenutup materi.';
const codeChunks = splitMessage(codeSample, 120);
console.log('Code chunks count:', codeChunks.length);
for (let i = 0; i < codeChunks.length; i++) {
  console.log(`Chunk ${i + 1} (${codeChunks[i].length} chars):\n${codeChunks[i]}\n---`);
}

console.log('splitMessage tests finished successfully.');
