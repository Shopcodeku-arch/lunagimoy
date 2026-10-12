/**
 * Utility to detect if a user prompt is asking to write, build, or analyze code/programming.
 */
export function isCodingRequest(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const raw = text.trim();
  if (raw.length < 3) return false;

  const lower = raw.toLowerCase();

  // 1. Direct explicit phrases in Indonesian asking to create/write programs or code
  const explicitIndonesianPatterns = [
    /buat(kan)?\s+(saya\s+)?(program|aplikasi|koding(an)?|coding(an)?|kode|skrip|script|software|web(site)?|landing page|bot|game|fitur)/i,
    /bikin(kan)?\s+(saya\s+)?(program|aplikasi|koding(an)?|coding(an)?|kode|skrip|script|software|web(site)?|landing page|bot|game|fitur)/i,
    /tulis(kan)?\s+(saya\s+)?(program|aplikasi|koding(an)?|coding(an)?|kode|skrip|script|software|fungsi|function|algoritma)/i,
    /rancang(kan)?\s+(program|aplikasi|kode|software|arsitektur kode)/i,
    /bantu(kan)?\s+(buat|bikin|tulis|coding|koding)\s+(program|aplikasi|kode|script|web)/i,
    /tolong\s+(buat(kan)?|bikin(kan)?|tulis(kan)?)\s+(saya\s+)?(program|aplikasi|koding(an)?|coding(an)?|kode|skrip|script|software|web(site)?|fungsi|function|algoritma|query)/i,
    /tolong\s+(coding|koding|program)/i,
    /cara\s+(buat|bikin|koding|coding)\s+(program|aplikasi|website|script)/i,
    /koding(an)?\s+(untuk|buat|bikin)/i,
    /coding(an)?\s+(untuk|buat|bikin)/i,
    /source\s*code\s+(untuk|buat|bikin)/i,
    /contoh\s+(koding(an)?|coding(an)?|source\s*code|skrip|script|syntax|sintaks)/i,
    /debug(ging)?\s+(kode|script|program|error)/i,
    /perbaiki\s+(kode|koding|error\s+kode|script|bug)/i,
    /buatkan\s+query\s+(sql|database|mongo)/i,
  ];

  for (const pattern of explicitIndonesianPatterns) {
    if (pattern.test(lower)) return true;
  }

  // 2. Direct English request patterns
  const englishPatterns = [
    /\b(write|create|build|generate|make|develop|code)\s+(a\s+)?(program|code|script|app|application|software|website|algorithm|function|component|bot)\b/i,
    /\b(can you|please|help me)\s+(code|program|write (code|a script))\b/i,
    /\b(debug|fix the bug|fix this error in (my|the) code)\b/i,
    /\bhow to (code|program)\b/i,
  ];

  for (const pattern of englishPatterns) {
    if (pattern.test(lower)) return true;
  }

  // 3. Programming languages or tech stack paired with programming actions
  const techLanguages = [
    'python', 'javascript', 'typescript', 'react', 'nextjs', 'vue', 'angular',
    'html', 'css', 'tailwind', 'php', 'laravel', 'c\\+\\+', 'c#', 'golang', 'rust',
    'java', 'kotlin', 'swift', 'flutter', 'dart', 'sql', 'mysql', 'postgresql',
    'bash', 'shell script', 'powershell', 'nodejs', 'express'
  ];
  const langRegex = new RegExp(`\\b(${techLanguages.join('|')})\\b`, 'i');

  const codingActions = [
    'buat', 'bikin', 'tulis', 'koding', 'coding', 'code', 'skrip', 'script',
    'fungsi', 'function', 'component', 'komponen', 'algoritma',
    'syntax', 'sintaks', 'query', 'endpoint',
    'write', 'build', 'create', 'generate', 'implement', 'debug'
  ];
  const actionRegex = new RegExp(`\\b(${codingActions.join('|')})\\b`, 'i');

  if (langRegex.test(lower) && actionRegex.test(lower)) {
    return true;
  }

  // 4. Code structure snippets pasted by user to debug or continue
  if (
    lower.includes('```') ||
    /(def\s+[a-z_0-9]+\(|function\s+[a-z_0-9]+\(|const\s+[a-z_0-9]+\s*=\s*\(|import\s+.+\s+from\s+['\"]|class\s+[a-z_0-9]+\s*\{)/i.test(raw)
  ) {
    return true;
  }

  return false;
}
