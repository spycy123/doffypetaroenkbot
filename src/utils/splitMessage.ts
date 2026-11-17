/**
 * Memecah teks pesan panjang agar tidak melebihi batas Telegram (4096 karakter).
 * Default aman: 4000 karakter untuk menyisakan ruang bagi tag formatting.
 *
 * Pemecahan dilakukan dengan memperhatikan:
 * 1. Tidak memotong di tengah blok kode (```...```).
 * 2. Memotong di akhir paragraf (\n\n), baris (\n), atau kalimat (. / ! / ?).
 * 3. Tidak memotong di tengah kata.
 */
export function splitMessage(text: string, maxLength: number = 4000): string[] {
  if (!text || text.length <= maxLength) {
    return [text || ''];
  }

  const chunks: string[] = [];

  // Pisahkan teks menjadi blok-blok (kode vs teks biasa)
  interface Block {
    isCode: boolean;
    lang?: string;
    content: string;
  }

  const blocks: Block[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index);
    if (textBefore) {
      blocks.push({ isCode: false, content: textBefore });
    }

    blocks.push({
      isCode: true,
      lang: match[1] || '',
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  const textAfter = text.slice(lastIndex);
  if (textAfter) {
    blocks.push({ isCode: false, content: textAfter });
  }

  let currentChunk = '';

  for (const block of blocks) {
    if (block.isCode) {
      // Jika blok kode muat di chunk saat ini
      const testChunk = currentChunk ? `${currentChunk}\n\n${block.content}` : block.content;
      if (testChunk.length <= maxLength) {
        currentChunk = testChunk;
      } else if (block.content.length <= maxLength) {
        // Blok kode tidak muat di currentChunk, simpan currentChunk dan jadikan blok ini chunk baru
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = block.content;
      } else {
        // Blok kode sendiri lebih panjang dari maxLength, pecah baris per baris di dalam kode
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        const lang = block.lang || '';
        const rawCode = block.content
          .replace(/^```[a-zA-Z0-9_-]*\n/, '')
          .replace(/```$/, '');
        const lines = rawCode.split('\n');

        let codeChunk = '';
        for (const line of lines) {
          const testCode = codeChunk ? `${codeChunk}\n${line}` : line;
          // Perhitungkan pembungkus ```lang\n ... \n```
          if (testCode.length + lang.length + 8 <= maxLength) {
            codeChunk = testCode;
          } else {
            if (codeChunk) {
              chunks.push(`\`\`\`${lang}\n${codeChunk}\n\`\`\``);
            }
            codeChunk = line;
          }
        }
        if (codeChunk) {
          currentChunk = `\`\`\`${lang}\n${codeChunk}\n\`\`\``;
        }
      }
    } else {
      // Blok teks biasa: pecah berdasarkan paragraf
      const paragraphs = block.content.split(/\n\n+/);

      for (const para of paragraphs) {
        const testChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;

        if (testChunk.length <= maxLength) {
          currentChunk = testChunk;
        } else if (para.length <= maxLength) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = para;
        } else {
          // Paragraf sangat panjang, pecah berdasarkan kalimat atau kata
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }

          const sentences = para.split(/(?<=[.!?])\s+/);
          let sentenceChunk = '';

          for (const s of sentences) {
            const testSent = sentenceChunk ? `${sentenceChunk} ${s}` : s;
            if (testSent.length <= maxLength) {
              sentenceChunk = testSent;
            } else if (s.length <= maxLength) {
              if (sentenceChunk.trim()) {
                chunks.push(sentenceChunk.trim());
              }
              sentenceChunk = s;
            } else {
              // Kalimat sangat panjang tanpa tanda baca: pecah berdasarkan kata
              if (sentenceChunk.trim()) {
                chunks.push(sentenceChunk.trim());
                sentenceChunk = '';
              }

              const words = s.split(/\s+/);
              let wordChunk = '';
              for (const w of words) {
                const testWord = wordChunk ? `${wordChunk} ${w}` : w;
                if (testWord.length <= maxLength) {
                  wordChunk = testWord;
                } else {
                  if (wordChunk.trim()) {
                    chunks.push(wordChunk.trim());
                  }
                  // Jika satu kata melebihi batas (ekstrem), potong paksa
                  if (w.length > maxLength) {
                    for (let i = 0; i < w.length; i += maxLength) {
                      chunks.push(w.slice(i, i + maxLength));
                    }
                    wordChunk = '';
                  } else {
                    wordChunk = w;
                  }
                }
              }
              if (wordChunk.trim()) {
                currentChunk = wordChunk;
              }
            }
          }

          if (sentenceChunk.trim()) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentenceChunk;
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}
