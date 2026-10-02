const zlib = require("zlib");

/**
 * Pulls the visible text out of a PDF buffer, for assertions.
 *
 * Two things make this less obvious than it sounds: page content is normally
 * zlib-compressed (the tests render with { compress: false } to avoid that), and pdfkit
 * writes text as hex strings - [<4173686f6b61> 100 <54>] TJ - rather than plain words. This
 * decodes both forms, so a test can assert "the bill says BILL OF SUPPLY and never says
 * CGST" without adding a PDF-parsing dependency.
 */
function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [];

  const streamRe = /stream\r?\n/g;
  let match;
  while ((match = streamRe.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end === -1) continue;

    const slice = Buffer.from(raw.slice(start, end).replace(/\r?\n$/, ""), "latin1");
    let content = slice.toString("latin1");
    if (!/\bTJ\b|\bTj\b/.test(content)) {
      try {
        content = zlib.inflateSync(slice).toString("latin1"); // compressed content stream
      } catch {
        continue; // a font or image stream - no text to read
      }
    }
    if (!/\bTJ\b|\bTj\b/.test(content)) continue;

    // Text-showing operators: [<hex> 100 (literal)] TJ, <hex> Tj, (literal) Tj
    for (const op of content.matchAll(/(\[[^\]]*\]|<[0-9A-Fa-f\s]*>|\((?:\\.|[^\\()])*\))\s*T[Jj]/g)) {
      const operand = op[1];
      let text = "";
      for (const part of operand.matchAll(/<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\()])*)\)/g)) {
        if (part[1] !== undefined) {
          text += Buffer.from(part[1].replace(/\s+/g, ""), "hex").toString("latin1");
        } else {
          text += part[2].replace(/\\([()\\])/g, "$1");
        }
      }
      chunks.push(text);
    }
  }
  return chunks.join(" ");
}

module.exports = { extractPdfText };
