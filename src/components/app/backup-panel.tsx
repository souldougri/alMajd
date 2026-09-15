import { useRef, useState, type ChangeEvent } from "react";
import { ArchiveRestore, Database, HardDriveDownload, Loader2 } from "lucide-react";
import { useSchool } from "@/lib/store";
import { validateBackupDocument } from "@/lib/storage/adapter";
import { cn } from "@/lib/utils";

/**
 * Backup & restore panel (super_admin). The backup document is the school
 * database document — auth users and their password hashes live in a separate
 * store and are intentionally never included, so a restore can never
 * overwrite accounts or reintroduce credentials.
 */
export function BackupPanel() {
  const exportBackup = useSchool((s) => s.exportBackup);
  const restoreFromDocument = useSchool((s) => s.restoreFromDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function handleExport() {
    exportBackup();
    setMessage({ ok: true, text: "تم إنشاء النسخة الاحتياطية وتنزيل الملف. احتفظ بها في مكان آمن." });
  }

  function handleRestore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        const result = validateBackupDocument(parsed);
        if (!result.success) {
          setMessage({ ok: false, text: result.errorAr });
          return;
        }
        restoreFromDocument(result.data);
        setMessage({ ok: true, text: "تمت استعادة النسخة الاحتياطية بنجاح." });
      } catch {
        setMessage({ ok: false, text: "الملف غير صالح — تأكد من أنه نسخة احتياطية بصيغة JSON." });
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setBusy(false);
      setMessage({ ok: false, text: "تعذر قراءة الملف المحدد." });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">النسخ الاحتياطي</h1>
        <p className="mt-1 text-sm text-navy/60">
          صدّر نسخة من جميع بيانات المدرسة (طلاب، فصول، نتائج، رسوم، موظفون) كملف JSON، وأعد
          استعادتها عند الحاجة. لا تتضمن النسخة حسابات المستخدمين ولا كلمات المرور أبدًا.
        </p>
      </div>

      <div className="max-w-xl space-y-3">
        <button
          type="button"
          onClick={handleExport}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-gold shadow-sm transition-opacity hover:opacity-90"
        >
          <HardDriveDownload className="size-5" />
          تنزيل نسخة احتياطية
        </button>

        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestore} />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-navy/20 bg-white text-navy shadow-sm transition-opacity",
            busy ? "opacity-50" : "hover:bg-cream",
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ArchiveRestore className="size-5" />}
          استعادة من ملف
        </button>

        {message ? (
          <p
            className={cn(
              "rounded-lg px-4 py-3 text-sm",
              message.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
