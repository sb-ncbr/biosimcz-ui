import { toast } from "sonner";

// Toast copy from missing-states 4.4. Clipboard access can be refused (insecure context, permissions), so it is caught.
// Resolves true when the text reached the clipboard, so a button can show its own "Copied" state.
const copyText = async (text: string, what: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what.charAt(0).toUpperCase()}${what.slice(1)} copied`);
    return true;
  } catch {
    toast.error(`Could not copy. Select the ${what} and copy it manually.`);
    return false;
  }
};

const copyDoi = async (doi: string): Promise<void> => {
  await copyText(doi, "DOI");
};

export { copyDoi, copyText };
