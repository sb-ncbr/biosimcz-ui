const UNSAFE = /[^A-Za-z0-9._-]+/g;

// Replica and analysis names contain spaces and slashes; the browser would otherwise rewrite them unpredictably.
const safeFilename = (name: string): string => name.trim().replace(UNSAFE, "_").replace(/^_+|_+$/g, "") || "download";

function saveDataUrl(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  saveDataUrl(url, filename);
  // Revoking in the same tick as the click can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export { safeFilename, saveBlob, saveDataUrl };
