/**
 * Escape karakter spesial HTML untuk Telegram Bot API (&, <, >)
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Mengonversi output teks Markdown dari LLM ke format HTML yang valid untuk Telegram.
 * Menjaga blok kode, inline code, bold, italic, strikethrough, link, dan list.
 */
export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return '';

  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // 1. Ekstrak blok kode ```lang ... ``` dan simpan ke placeholder khusus yang tidak terpengaruh markdown
  let text = markdown.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const escapedCode = escapeHtml(code.replace(/\n+$/, ''));
    const placeholder = `\uE000CB${codeBlocks.length}\uE001`;
    if (lang) {
      codeBlocks.push(`<pre><code class="language-${escapeHtml(lang)}">${escapedCode}</code></pre>`);
    } else {
      codeBlocks.push(`<pre>${escapedCode}</pre>`);
    }
    return placeholder;
  });

  // 2. Ekstrak inline code `...` dan simpan ke placeholder
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const placeholder = `\uE000IC${inlineCodes.length}\uE001`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // 3. Escape karakter HTML pada teks umum
  text = escapeHtml(text);

  // 4. Header Markdown (# Judul, ## Subjudul) -> <b>Judul</b>
  text = text.replace(/^[ \t]*#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // 5. Bold Markdown (**teks** atau __teks__)
  text = text.replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>');
  text = text.replace(/__(.+?)__/gs, '<b>$1</b>');

  // 6. Italic Markdown (*teks* atau _teks_)
  text = text.replace(/(^|[^\*])\*([^\*\n]+?)\*([^\*]|$)/g, '$1<i>$2</i>$3');
  text = text.replace(/(^|[^_])_([^_\n]+?)_([^_]|$)/g, '$1<i>$2</i>$3');

  // 7. Strikethrough Markdown (~~teks~~)
  text = text.replace(/~~(.+?)~~/gs, '<s>$1</s>');

  // 8. Markdown Links [judul](url) - hanya izinkan http/https/tg
  text = text.replace(/\[(.+?)\]\(((?:https?:\/\/|tg:\/\/)[^\s\)]+)\)/g, '<a href="$2">$1</a>');

  // 9. Bullet lists (* item atau - item) -> • item
  text = text.replace(/^[ \t]*[\*\-]\s+(.+)$/gm, '• $1');

  // 10. Kembalikan inline code
  text = text.replace(/\uE000IC(\d+)\uE001/g, (_, idx) => {
    return inlineCodes[Number(idx)] || '';
  });

  // 11. Kembalikan code blocks
  text = text.replace(/\uE000CB(\d+)\uE001/g, (_, idx) => {
    return codeBlocks[Number(idx)] || '';
  });

  return text;
}
