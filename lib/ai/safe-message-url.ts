/** URL policy for untrusted Markdown. Attachments are validated separately. */
export function safeMessageUrl(value: string, kind: 'link' | 'media' = 'link'): string {
  const text = value.trim();
  if (!text || text.length > 7_000_000 || /\p{Cc}/u.test(text)) return '';
  if (/^data:/i.test(text)) {
    // Raster image/video previews are retained. HTML, SVG and active documents
    // must never become executable navigation through the Markdown renderer.
    return /^data:(?:image\/(?:png|jpeg|webp)|video\/(?:mp4|webm|ogg));base64,[A-Za-z0-9+/]+={0,2}$/i.test(text) ? text : '';
  }
  try {
    const url = new URL(text, 'https://aet.invalid/');
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return text;
    if (kind === 'link' && url.protocol === 'mailto:') return text;
  } catch { /* Invalid or active URL is not rendered as a link/media source. */ }
  return '';
}
