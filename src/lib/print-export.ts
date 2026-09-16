/**
 * Shared print → PDF export for the school documents.
 *
 * There is ONE document source (the `.print-sheet` DOM rendered by the print
 * preview). Desktop browsers and Electron keep using the native print dialog;
 * on Android (Capacitor WebView, where `window.print()` is unreliable) the same
 * element is rasterized and assembled into a viewport-complete PDF that the
 * user can save/share.
 *
 * This reuses the existing print preview — no separate document design.
 */
import { toCanvas } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import { isAndroid } from "@/lib/platform";

// A4 at 96dpi (210mm × 297mm) — matches `.print-sheet` in styles.css.
const A4_HEIGHT_PX = 1123;

async function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Rasterizes the document node and assembles a complete multi-page PDF.
 * Content is never clipped: long sheets are split across A4 pages.
 */
export async function exportPrintSheetAsPdf(root: HTMLElement): Promise<Uint8Array> {
  const full = await toCanvas(root, {
    pixelRatio: 1,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  const width = full.width;
  const height = full.height;
  const pageCount = Math.max(1, Math.ceil(height / A4_HEIGHT_PX));

  const doc = await PDFDocument.create();
  const pageSize: [number, number] = [595.28, 841.89]; // A4 in PDF points

  for (let i = 0; i < pageCount; i++) {
    const y = i * A4_HEIGHT_PX;
    const sliceH = Math.min(A4_HEIGHT_PX, height - y);

    const slice = document.createElement("canvas");
    slice.width = width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unsupported");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, sliceH);
    ctx.drawImage(full, 0, -y, width, height);

    const jpeg = await canvasToJpegBytes(slice);
    const img = await doc.embedJpg(jpeg);

    const page = doc.addPage(pageSize);
    const scale = page.getWidth() / img.width;
    const drawH = img.height * scale;
    // Align to the top so a partial last page keeps the sheet flow.
    page.drawImage(img, {
      x: 0,
      y: page.getHeight() - drawH,
      width: page.getWidth(),
      height: drawH,
    });
  }

  return doc.save();
}

export type PrintExportOptions = {
  /** Element to rasterize on Android. Falls back to `rootSelector` / `.print-sheet`. */
  root?: HTMLElement | null;
  /** Selector used when `root` is not provided. */
  rootSelector?: string;
  filename?: string;
};

/**
 * Desktop (browser + Electron): native print dialog.
 * Android: generate and download the same document as a PDF.
 */
export async function printOrExportPdf(options: PrintExportOptions = {}): Promise<void> {
  if (!isAndroid()) {
    window.print();
    return;
  }

  const root = options.root ?? document.querySelector<HTMLElement>(options.rootSelector ?? ".print-sheet");
  if (!root) {
    window.alert("تعذر العثور على الوثيقة لإنشاء ملف PDF. أعد فتح المعاينة وحاول مجددًا.");
    return;
  }

  try {
    const bytes = await exportPrintSheetAsPdf(root);
    // pdf-lib returns Uint8Array<ArrayBufferLike>; copy into a concrete
    // ArrayBuffer-backed view so it's a valid BlobPart under strict TS.
    const buffer = new Uint8Array(bytes);
    const blob = new Blob([buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = options.filename ?? "document.pdf";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // Keep the object URL alive long enough for the download to start.
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);

    window.alert(
      "تم إنشاء ملف PDF بنجاح. إذا لم يبدأ التنزيل تلقائيًا، افتحه من قائمة التنزيلات أو ملف التحميلات في جهازك.",
    );
  } catch (err) {
    console.error("[print-export] PDF generation failed:", err);
    window.alert("تعذر إنشاء ملف PDF. تحقق من اتصال الشبكة وأعد المحاولة.");
  }
}