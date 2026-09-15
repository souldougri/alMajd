import { api } from "@/lib/api";

export type ContactMessageInput = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

/** Submits a contact form message to the server (public). */
export async function submitContactMessage(input: ContactMessageInput): Promise<void> {
  const res = await api.post<{ id: string }>("/api/contact", input);
  if (!res.ok) throw new Error(res.error ?? "تعذر إرسال الرسالة");
}