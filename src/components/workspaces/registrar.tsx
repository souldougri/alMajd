import { PrintProvider } from "@/components/desk/print";
import { StudentsView } from "@/components/desk/students";
import { WorkspaceFrame } from "@/components/workspaces/workspace-frame";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { useSchool } from "@/lib/store";

export function RegistrarPage() {
  const students = useSchool((s) => s.students);

  return (
    <WorkspaceFrame ws="registrar">
      <div className="space-y-6">
        <div className="am-card p-4 shadow-sm sm:p-6">
          <PrintProvider>
            <StudentsView mode="registrar" />
          </PrintProvider>
        </div>
        <div className="am-card p-4 shadow-sm sm:p-6">
          <PrintProvider>
            <DocumentsPanel
              canUpload
              uploadMode="linked_student"
              students={students.map((s) => ({ id: s.id, nameAr: s.nameAr }))}
            />
          </PrintProvider>
        </div>
      </div>
    </WorkspaceFrame>
  );
}