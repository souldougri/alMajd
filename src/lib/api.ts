export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

function parseError(res: Response): string {
  return `حدث خطأ في الاتصال بالخادم (${res.status})`;
}

async function raw<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null, error: "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت." };
  }

  let json: ({ ok?: boolean; error?: string } & T) | null = null;
  try {
    json = (await res.json()) as { ok?: boolean; error?: string } & T;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !json || json.ok === false) {
    return { ok: false, status: res.status, data: null, error: json?.error ?? parseError(res) };
  }
  return { ok: true, status: res.status, data: json };
}

export const api = {
  get<T>(path: string): Promise<ApiResult<T>> {
    return raw<T>("GET", path);
  },
  post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return raw<T>("POST", path, body);
  },
  put<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return raw<T>("PUT", path, body);
  },
  del<T>(path: string): Promise<ApiResult<T>> {
    return raw<T>("DELETE", path);
  },
  /** Uploads a file via multipart FormData (no Content-Type header — set by the browser). */
  async upload<T>(path: string, form: FormData): Promise<ApiResult<T>> {
    let res: Response;
    try {
      res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
    } catch {
      return { ok: false, status: 0, data: null, error: "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت." };
    }
    let json: ({ ok?: boolean; error?: string } & T) | null = null;
    try {
      json = (await res.json()) as { ok?: boolean; error?: string } & T;
    } catch {
      /* non-JSON response */
    }
    if (!res.ok || !json || json.ok === false) {
      return { ok: false, status: res.status, data: null, error: json?.error ?? parseError(res) };
    }
    return { ok: true, status: res.status, data: json };
  },
};