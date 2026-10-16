// لایه‌ی ارتباط با بک‌اند PRT (Express + SQLite + LDAP). همه‌ی مسیرها زیر /api/v1 هستند و
// احراز هویت با کوکی نشست انجام می‌شود (sameSite=lax، httpOnly).
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.', 0);
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* پاسخ غیر JSON */
  }
  if (!res.ok || (json && json.ok === false)) {
    throw new ApiError((json && json.error) || `خطای سرور (${res.status})`, res.status);
  }
  return json as T;
}
