export function toHttpError(err) {
  const status = err?.status || err?.response?.status || 500;

  const message =
    err?.error?.message ||
    err?.response?.data?.error?.message ||
    err?.message ||
    "Server error";

  return { status, message };
}
