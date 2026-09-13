// Triggers a browser download for a blob response. Used for invoice PDFs and CSV
// exports, which require an Authorization header and so can't just be plain <a href> links.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
