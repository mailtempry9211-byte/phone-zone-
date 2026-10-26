/**
 * Print and PDF generation helper for PhoneZone.
 * Uses an invisible iframe to prevent popup blockers and Electron window block issues.
 */
export function printHtml(html: string) {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (_e) {
          // fallback
          fallbackWindow(html);
        } finally {
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (_e) {}
          }, 3000);
        }
      }, 400);
      return;
    }
  } catch (_err) {
    // fallback
  }

  fallbackWindow(html);
}

function fallbackWindow(html: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  }
}

