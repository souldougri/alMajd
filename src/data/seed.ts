import type { Payment, Staff, Student, Warning } from "@/lib/types";

export const seedStudents: Student[] = [];
export const seedStaff: Staff[] = [];
export const seedPayments: Payment[] = [];
export const seedWarnings: Warning[] = [];
export const seedAttendance: Record<string, Record<string, "present" | "absent" | "late">> = {};

export const FIXTURE_STAFF_IDS = new Set(["t1", "t2", "t3", "t4", "t5", "t6"]);
export const FIXTURE_STUDENT_IDS = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"]);
