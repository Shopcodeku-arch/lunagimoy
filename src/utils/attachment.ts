// Format lampiran: [File Terlampir: nama]\n~~~~~\nisi\n~~~~~\n\npesan
// (format lama dengan ``` tetap dikenali agar riwayat lama tetap tampil rapi)
const ATTACH_RE = /^\[File Terlampir: ([^\]\n]+)\]\n(```|~~~~~)[^\n]*\n([\s\S]*?)\n\2\n*/;

export function buildAttachmentMessage(name: string, content: string, text: string): string {
  return `[File Terlampir: ${name}]\n~~~~~\n${content}\n~~~~~\n\n${text}`.trimEnd();
}

export function splitAttachment(content: string): { name: string | null; body: string; text: string } {
  const m = ATTACH_RE.exec(content);
  if (!m) return { name: null, body: '', text: content };
  return { name: m[1], body: m[3], text: content.slice(m[0].length) };
}
