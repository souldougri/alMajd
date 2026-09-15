import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5MB
const MAX_PHOTO_EDGE = 500; // Max dimension for photo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "يرجى اختيار صورة بصيغة JPG أو PNG أو WebP فقط",
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "حجم الصورة كبير جداً. الحد الأقصى 1.5 ميجابايت",
    };
  }
  return { valid: true };
}

export async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Calculate dimensions to maintain aspect ratio
        if (width > height) {
          if (width > MAX_PHOTO_EDGE) {
            height = (height * MAX_PHOTO_EDGE) / width;
            width = MAX_PHOTO_EDGE;
          }
        } else {
          if (height > MAX_PHOTO_EDGE) {
            width = (width * MAX_PHOTO_EDGE) / height;
            height = MAX_PHOTO_EDGE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.8 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function processPhotoFile(file: File): Promise<{ dataUrl: string; error?: string }> {
  const validation = validatePhotoFile(file);
  if (!validation.valid) {
    return { dataUrl: "", error: validation.error };
  }

  try {
    const dataUrl = await compressPhoto(file);
    return { dataUrl };
  } catch (err) {
    return {
      dataUrl: "",
      error: "حدث خطأ أثناء معالجة الصورة. يرجى المحاولة مرة أخرى",
    };
  }
}
