export type ReplySegment =
  | { kind: "text"; content: string }
  | { kind: "code"; content: string; language: string | null };

const FENCE = /^\s*```\s*([\w#+.-]*)\s*$/;

/**
 * Splits a mentor reply into prose and ``` fenced code blocks, which the
 * backend asks the model to use for code. An unclosed fence (a truncated
 * reply) runs to the end, so code is never shown as prose. Empty segments
 * are dropped.
 */
export function splitCodeBlocks(text: string): ReplySegment[] {
  const segments: ReplySegment[] = [];
  let buffer: string[] = [];
  let code: { language: string | null } | null = null;

  const flush = () => {
    const content = code ? buffer.join("\n") : buffer.join("\n").trim();
    if (content.trim()) {
      segments.push(code ? { kind: "code", content, language: code.language } : { kind: "text", content });
    }
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const fence = FENCE.exec(line);
    if (!fence) {
      buffer.push(line);
      continue;
    }
    flush();
    code = code ? null : { language: fence[1] || null };
  }
  flush();
  return segments;
}
