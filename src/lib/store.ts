import { create } from "zustand";
import {
  createDefaultDocument,
  downloadBackupFile,
  loadSchoolDocument,
  saveSchoolDocument,
  type SchoolDatabaseDocument,
} from "@/lib/storage";
import { CURRENT_SCHEMA_VERSION } from "@/lib/storage/types";
import { isDesktop, pushChanges } from "@/lib/relational";
import { getAppreciation } from "@/lib/constants";
import type { AttendanceMap, AttendanceStatus, ClassSection, ExamSession, Expense, FeeType, Grade, Payment, Staff, Student, Subject, Term, TimetableEntry, Warning } from "@/lib/types";

export type ViewId =
  | "home"
  | "students"
  | "classes"
  | "subjects"
  | "grades"
  | "staff"
  | "attendance"
  | "fees"
  | "cards"
  | "certificates"
  | "warnings";

type SchoolState = {
  view: ViewId;
  students: Student[];
  classes: ClassSection[];
  subjects: Subject[];
  terms: Term[];
  grades: Grade[];
  staff: Staff[];
  payments: Payment[];
  warnings: Warning[];
  attendance: Record<string, AttendanceMap>;
  feeTypes: FeeType[];
  expenses: Expense[];
  examSessions: ExamSession[];
  timetable: TimetableEntry[];
  publishedResults: Record<string, boolean>;
  selectedId: string | null;
  schoolYear: string;
  setView: (view: ViewId) => void;
  select: (id: string | null) => void;
  setSchoolYear: (year: string) => void;
  addStudent: (s: Omit<Student, "id"> & { id?: string }) => Student;
  editStudent: (id: string, updates: Partial<Omit<Student, "id">>) => void;
  deleteStudent: (id: string) => void;
  addClass: (c: Omit<ClassSection, "id">) => void;
  editClass: (id: string, updates: Partial<Omit<ClassSection, "id">>) => void;
  deleteClass: (id: string) => void;
  addSubject: (s: Omit<Subject, "id">) => void;
  editSubject: (id: string, updates: Partial<Omit<Subject, "id">>) => void;
  deleteSubject: (id: string) => void;
  upsertGrade: (g: Omit<Grade, "id">) => void;
  deleteGrade: (studentId: string, subjectId: string, termId: string) => void;
  computeBulletin: (studentId: string, termId: string) => { average: number; appreciation: string };
  computeClassRanking: (classId: string, termId: string) => Array<{ studentId: string; rank: number }>;
  addPayment: (studentId: string, amount: number, note: string) => void;
  addWarning: (w: Omit<Warning, "id" | "date">) => void;
  mark: (date: string, studentId: string, status: AttendanceStatus) => void;
  paidOf: (studentId: string) => number;
  addFeeType: (f: Omit<FeeType, "id">) => void;
  deleteFeeType: (id: string) => void;
  addExpense: (e: Omit<Expense, "id">) => string;
  deleteExpense: (id: string) => void;
  addTerm: (t: Omit<Term, "id">) => void;
  editTerm: (id: string, updates: Partial<Omit<Term, "id">>) => void;
  deleteTerm: (id: string) => void;
  addExamSession: (s: Omit<ExamSession, "id">) => void;
  deleteExamSession: (id: string) => void;
  setTimetableEntry: (classId: string, day: number, slot: number, subjectId: string | null) => void;
  setBulletinPublished: (classId: string, termId: string, published: boolean) => void;
  resetDemo: () => void;
  exportBackup: () => void;
  restoreFromDocument: (doc: SchoolDatabaseDocument) => void;
  getCurrentDocument: () => SchoolDatabaseDocument;
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Desktop keeps the legacy JSON document for temporary compatibility (it syncs
// to a local file). The web build starts empty and is hydrated from the
// relational APIs — the JSON store is never written on the web anymore.
const DESKTOP_BUILD = isDesktop();

const EMPTY_DOCUMENT: SchoolDatabaseDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  students: [],
  classes: [],
  subjects: [],
  terms: [],
  grades: [],
  staff: [],
  payments: [],
  warnings: [],
  attendance: {},
  feeTypes: [],
  expenses: [],
  examSessions: [],
  timetable: [],
  publishedResults: {},
  system: {
    name: "مجمع المجد التعليمي العربي",
    academicYear: "2026–2027",
    version: "1.0.0",
  },
};

const initialDoc = DESKTOP_BUILD ? loadSchoolDocument() : EMPTY_DOCUMENT;

function syncToStorage(state: {
  students: Student[];
  classes: ClassSection[];
  subjects: Subject[];
  terms: Term[];
  grades: Grade[];
  staff: Staff[];
  payments: Payment[];
  warnings: Warning[];
  attendance: Record<string, AttendanceMap>;
  feeTypes?: FeeType[];
  expenses?: Expense[];
  examSessions?: ExamSession[];
  timetable?: TimetableEntry[];
  publishedResults?: Record<string, boolean>;
  schoolYear?: string;
}) {
  if (DESKTOP_BUILD) {
    saveSchoolDocument({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      students: state.students,
      classes: state.classes,
      subjects: state.subjects,
      terms: state.terms,
      grades: state.grades,
      staff: state.staff,
      payments: state.payments,
      warnings: state.warnings,
      attendance: state.attendance,
      feeTypes: state.feeTypes ?? [],
      expenses: state.expenses ?? [],
      examSessions: state.examSessions ?? [],
      timetable: state.timetable ?? [],
      publishedResults: state.publishedResults ?? {},
      system: {
        name: "مجمع المجد التعليمي العربي",
        academicYear: state.schoolYear ?? "2026–2027",
        version: "1.0.0",
      },
    });
    return;
  }
  // Web: relay the transition to the relational persistence adapter.
  // Inside a set() updater, getState() is the pre-mutation snapshot, which is
  // exactly the "prev" frame pushChanges diffs against `state`.
  pushChanges(useSchool.getState(), state);
}

export const useSchool = create<SchoolState>()(
  (set, get) => ({
      view: "home",
      students: initialDoc.students,
      classes: initialDoc.classes,
      subjects: initialDoc.subjects,
      terms: initialDoc.terms,
      grades: initialDoc.grades,
      staff: initialDoc.staff,
      payments: initialDoc.payments,
      warnings: initialDoc.warnings,
      attendance: initialDoc.attendance,
      selectedId: initialDoc.students[0]?.id ?? null,
      schoolYear: initialDoc.system?.academicYear ?? "2026–2027",
      feeTypes: initialDoc.feeTypes ?? [],
      expenses: initialDoc.expenses ?? [],
      examSessions: initialDoc.examSessions ?? [],
      timetable: initialDoc.timetable ?? [],
      publishedResults: initialDoc.publishedResults ?? {},
      setView: (view) => set({ view }),
      select: (id) => set({ selectedId: id }),
      setSchoolYear: (year) =>
        set((st) => {
          const nextState = { ...st, schoolYear: year };
          syncToStorage(nextState);
          return { schoolYear: year };
        }),
      addStudent: (s) => {
        const id = s.id ?? uid("s");
        const student = { ...s, id };
        set((st) => {
          const nextStudents = [student, ...st.students];
          syncToStorage({ ...st, students: nextStudents });
          return { students: nextStudents, selectedId: id, view: "students" };
        });
        return student;
      },
      editStudent: (id, updates) =>
        set((st) => {
          const nextStudents = st.students.map((s) => (s.id === id ? { ...s, ...updates } : s));
          syncToStorage({ ...st, students: nextStudents });
          return { students: nextStudents };
        }),
      deleteStudent: (id) =>
        set((st) => {
          const nextStudents = st.students.filter((s) => s.id !== id);
          const nextPayments = st.payments.filter((p) => p.studentId !== id);
          const nextWarnings = st.warnings.filter((w) => w.studentId !== id);
          const nextGrades = st.grades.filter((g) => g.studentId !== id);
          const nextAttendance: Record<string, AttendanceMap> = {};
          for (const [date, dayMap] of Object.entries(st.attendance)) {
            const filteredDay: AttendanceMap = {};
            for (const [sid, status] of Object.entries(dayMap)) {
              if (sid !== id) {
                filteredDay[sid] = status;
              }
            }
            if (Object.keys(filteredDay).length > 0) {
              nextAttendance[date] = filteredDay;
            }
          }
          syncToStorage({
            ...st,
            students: nextStudents,
            payments: nextPayments,
            warnings: nextWarnings,
            grades: nextGrades,
            attendance: nextAttendance,
          });
          return {
            students: nextStudents,
            payments: nextPayments,
            warnings: nextWarnings,
            grades: nextGrades,
            attendance: nextAttendance,
            selectedId: nextStudents[0]?.id ?? null,
          };
        }),
      addClass: (c) =>
        set((st) => {
          const id = uid("c");
          const nextClasses = [{ ...c, id }, ...st.classes];
          syncToStorage({ ...st, classes: nextClasses });
          return { classes: nextClasses };
        }),
      editClass: (id, updates) =>
        set((st) => {
          const nextClasses = st.classes.map((cls) => (cls.id === id ? { ...cls, ...updates } : cls));
          syncToStorage({ ...st, classes: nextClasses });
          return { classes: nextClasses };
        }),
      deleteClass: (id) =>
        set((st) => {
          const hasStudents = st.students.some((s) => s.classId === id);
          if (hasStudents) {
            throw new Error("لا يمكن حذف فصل به طلاب مسجلين");
          }
          const nextClasses = st.classes.filter((c) => c.id !== id);
          syncToStorage({ ...st, classes: nextClasses });
          return { classes: nextClasses };
        }),
      addSubject: (s) =>
        set((st) => {
          const id = uid("sub");
          const nextSubjects = [{ ...s, id }, ...st.subjects];
          syncToStorage({ ...st, subjects: nextSubjects });
          return { subjects: nextSubjects };
        }),
      editSubject: (id, updates) =>
        set((st) => {
          const nextSubjects = st.subjects.map((sub) => (sub.id === id ? { ...sub, ...updates } : sub));
          syncToStorage({ ...st, subjects: nextSubjects });
          return { subjects: nextSubjects };
        }),
      deleteSubject: (id) =>
        set((st) => {
          const nextSubjects = st.subjects.filter((s) => s.id !== id);
          const nextGrades = st.grades.filter((g) => g.subjectId !== id);
          syncToStorage({ ...st, subjects: nextSubjects, grades: nextGrades });
          return { subjects: nextSubjects, grades: nextGrades };
        }),
      upsertGrade: (g) =>
        set((st) => {
          const existingIndex = st.grades.findIndex(
            (grade) => grade.studentId === g.studentId && grade.subjectId === g.subjectId && grade.termId === g.termId,
          );
          let nextGrades;
          if (existingIndex >= 0) {
            nextGrades = [...st.grades];
            nextGrades[existingIndex] = { ...g, id: st.grades[existingIndex].id };
          } else {
            nextGrades = [{ ...g, id: uid("g") }, ...st.grades];
          }
          syncToStorage({ ...st, grades: nextGrades });
          return { grades: nextGrades };
        }),
      deleteGrade: (studentId, subjectId, termId) =>
        set((st) => {
          const nextGrades = st.grades.filter(
            (g) => !(g.studentId === studentId && g.subjectId === subjectId && g.termId === termId)
          );
          syncToStorage({ ...st, grades: nextGrades });
          return { grades: nextGrades };
        }),
      computeBulletin: (studentId, termId) => {
        const st = get();
        const studentGrades = st.grades.filter((g) => g.studentId === studentId && g.termId === termId);
        if (studentGrades.length === 0) return { average: 0, appreciation: "" };

        let weightedSum = 0;
        let totalCoefficient = 0;

        for (const grade of studentGrades) {
          const subject = st.subjects.find((s) => s.id === grade.subjectId);
          if (subject) {
            const normalizedScore = grade.score / grade.maxScore;
            weightedSum += normalizedScore * subject.coefficient;
            totalCoefficient += subject.coefficient;
          }
        }

        const average = totalCoefficient > 0 ? (weightedSum / totalCoefficient) * 20 : 0;
        return { average, appreciation: getAppreciation(average) };
      },
      computeClassRanking: (classId, termId) => {
        const st = get();
        const classStudents = st.students.filter((s) => s.classId === classId);
        const rankings = classStudents.map((student) => {
          const bulletin = get().computeBulletin(student.id, termId);
          return { studentId: student.id, average: bulletin.average };
        });

        // Sort by average descending
        rankings.sort((a, b) => b.average - a.average);

        // Assign ranks (ties share same rank)
        const result: Array<{ studentId: string; rank: number }> = [];
        for (let i = 0; i < rankings.length; i++) {
          const current = rankings[i];
          const prev = i > 0 ? rankings[i - 1] : null;
          const rank = prev && prev.average === current.average ? result[i - 1].rank : i + 1;
          result.push({ studentId: current.studentId, rank });
        }

        return result;
      },
      addPayment: (studentId, amount, note) =>
        set((st) => {
          const nextPayments = [
            { id: uid("p"), studentId, amount, note, date: todayIso() },
            ...st.payments,
          ];
          syncToStorage({ ...st, payments: nextPayments });
          return { payments: nextPayments };
        }),
      addWarning: (w) =>
        set((st) => {
          const nextWarnings = [{ ...w, id: uid("w"), date: todayIso() }, ...st.warnings];
          syncToStorage({ ...st, warnings: nextWarnings });
          return { warnings: nextWarnings };
        }),
      mark: (date, studentId, status) =>
        set((st) => {
          const nextAttendance = {
            ...st.attendance,
            [date]: { ...(st.attendance[date] ?? {}), [studentId]: status },
          };
          syncToStorage({ ...st, attendance: nextAttendance });
          return { attendance: nextAttendance };
        }),
      paidOf: (studentId) =>
        get()
          .payments.filter((p) => p.studentId === studentId)
          .reduce((sum, p) => sum + p.amount, 0),
      addFeeType: (f) =>
        set((st) => {
          const nextFeeTypes = [{ ...f, id: uid("ft") }, ...st.feeTypes];
          syncToStorage({ ...st, feeTypes: nextFeeTypes });
          return { feeTypes: nextFeeTypes };
        }),
      deleteFeeType: (id) =>
        set((st) => {
          const nextFeeTypes = st.feeTypes.filter((f) => f.id !== id);
          syncToStorage({ ...st, feeTypes: nextFeeTypes });
          return { feeTypes: nextFeeTypes };
        }),
      addExpense: (e) => {
        const id = uid("ex");
        set((st) => {
          const nextExpenses = [
            { ...e, date: e.date || todayIso(), id },
            ...st.expenses,
          ];
          syncToStorage({ ...st, expenses: nextExpenses });
          return { expenses: nextExpenses };
        });
        return id;
      },
      deleteExpense: (id) =>
        set((st) => {
          const nextExpenses = st.expenses.filter((e) => e.id !== id);
          syncToStorage({ ...st, expenses: nextExpenses });
          return { expenses: nextExpenses };
        }),
      addTerm: (t) =>
        set((st) => {
          const nextTerms = [...st.terms, { ...t, id: uid("term") }];
          syncToStorage({ ...st, terms: nextTerms });
          return { terms: nextTerms };
        }),
      editTerm: (id, updates) =>
        set((st) => {
          const nextTerms = st.terms.map((t) => (t.id === id ? { ...t, ...updates } : t));
          syncToStorage({ ...st, terms: nextTerms });
          return { terms: nextTerms };
        }),
      deleteTerm: (id) =>
        set((st) => {
          const hasGrades = st.grades.some((g) => g.termId === id);
          if (hasGrades) {
            throw new Error("لا يمكن حذف فصل دراسي عليه درجات مسجلة");
          }
          const nextTerms = st.terms.filter((t) => t.id !== id);
          syncToStorage({ ...st, terms: nextTerms });
          return { terms: nextTerms };
        }),
      addExamSession: (s) =>
        set((st) => {
          const nextExamSessions = [{ ...s, id: uid("es") }, ...st.examSessions];
          syncToStorage({ ...st, examSessions: nextExamSessions });
          return { examSessions: nextExamSessions };
        }),
      deleteExamSession: (id) =>
        set((st) => {
          const nextExamSessions = st.examSessions.filter((s) => s.id !== id);
          syncToStorage({ ...st, examSessions: nextExamSessions });
          return { examSessions: nextExamSessions };
        }),
      setTimetableEntry: (classId, day, slot, subjectId) =>
        set((st) => {
          const others = st.timetable.filter((t) => !(t.classId === classId && t.day === day && t.slot === slot));
          const nextTimetable =
            subjectId && subjectId.trim() ? [...others, { id: uid("tt"), classId, day, slot, subjectId }] : others;
          syncToStorage({ ...st, timetable: nextTimetable });
          return { timetable: nextTimetable };
        }),
      setBulletinPublished: (classId, termId, published) =>
        set((st) => {
          const nextPublishedResults = { ...(st.publishedResults ?? {}), [`${classId}::${termId}`]: published };
          syncToStorage({ ...st, publishedResults: nextPublishedResults });
          return { publishedResults: nextPublishedResults };
        }),
      resetDemo: () => {
        const defaultDoc = createDefaultDocument();
        const year = defaultDoc.system?.academicYear ?? "2026–2027";
        const st = get();
        syncToStorage({
          ...st,
          students: defaultDoc.students,
          classes: defaultDoc.classes,
          subjects: defaultDoc.subjects,
          terms: defaultDoc.terms,
          grades: defaultDoc.grades,
          staff: defaultDoc.staff,
          payments: defaultDoc.payments,
          warnings: defaultDoc.warnings,
          attendance: defaultDoc.attendance,
          feeTypes: defaultDoc.feeTypes ?? [],
          expenses: defaultDoc.expenses ?? [],
          examSessions: defaultDoc.examSessions ?? [],
          timetable: defaultDoc.timetable ?? [],
          publishedResults: defaultDoc.publishedResults ?? {},
          schoolYear: year,
        });
        set({
          students: defaultDoc.students,
          classes: defaultDoc.classes,
          subjects: defaultDoc.subjects,
          terms: defaultDoc.terms,
          grades: defaultDoc.grades,
          staff: defaultDoc.staff,
          payments: defaultDoc.payments,
          warnings: defaultDoc.warnings,
          attendance: defaultDoc.attendance,
          feeTypes: defaultDoc.feeTypes ?? [],
          expenses: defaultDoc.expenses ?? [],
          examSessions: defaultDoc.examSessions ?? [],
          timetable: defaultDoc.timetable ?? [],
          publishedResults: defaultDoc.publishedResults ?? {},
          selectedId: defaultDoc.students[0]?.id ?? null,
          schoolYear: year,
        });
      },
      getCurrentDocument: (): SchoolDatabaseDocument => {
        const st = get();
        return {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          students: st.students,
          classes: st.classes,
          subjects: st.subjects,
          terms: st.terms,
          grades: st.grades,
          staff: st.staff,
          payments: st.payments,
          warnings: st.warnings,
          attendance: st.attendance,
          feeTypes: st.feeTypes,
          expenses: st.expenses,
          examSessions: st.examSessions,
          timetable: st.timetable,
          publishedResults: st.publishedResults ?? {},
          system: {
            name: "مجمع المجد التعليمي العربي",
            academicYear: st.schoolYear,
            version: "1.0.0",
          },
        };
      },
      exportBackup: () => {
        const doc = get().getCurrentDocument();
        downloadBackupFile(doc);
      },
      restoreFromDocument: (doc: SchoolDatabaseDocument) => {
        const year = doc.system?.academicYear ?? "2026–2027";
        const students = doc.students.map((s) => ({
          ...s,
          placeOfBirth: s.placeOfBirth ?? "",
        }));
        const st = get();
        syncToStorage({
          ...st,
          students,
          classes: doc.classes,
          subjects: doc.subjects,
          terms: doc.terms,
          grades: doc.grades,
          staff: doc.staff,
          payments: doc.payments,
          warnings: doc.warnings,
          attendance: doc.attendance,
          feeTypes: doc.feeTypes ?? [],
          expenses: doc.expenses ?? [],
          examSessions: doc.examSessions ?? [],
          timetable: doc.timetable ?? [],
          publishedResults: doc.publishedResults ?? {},
          schoolYear: year,
        });
        set({
          students,
          classes: doc.classes,
          subjects: doc.subjects,
          terms: doc.terms,
          grades: doc.grades,
          staff: doc.staff,
          payments: doc.payments,
          warnings: doc.warnings,
          attendance: doc.attendance,
          feeTypes: doc.feeTypes ?? [],
          expenses: doc.expenses ?? [],
          examSessions: doc.examSessions ?? [],
          timetable: doc.timetable ?? [],
          publishedResults: doc.publishedResults ?? {},
          selectedId: students[0]?.id ?? null,
          schoolYear: year,
        });
      },
    }),
);
