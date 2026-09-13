// Triggers a browser download for a blob response. Used for invoice PDFs, which require
// an Authorization header and so can't just be linked to directly with a plain <a href>.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
