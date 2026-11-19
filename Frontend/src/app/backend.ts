export async function postToBackend(path: string, payload: unknown) {
  const csrf = await fetch('/api/auth/csrf/');
  if (!csrf.ok) throw new Error('Could not reach the backend.');
  const { csrfToken } = await csrf.json();
  const response = await fetch(path, {
    method: 'POST',
    headers: payload instanceof FormData ? { 'X-CSRFToken': csrfToken } :
      { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((response.status === 403
      ? 'Sign in with an admin or finance account to upload attendance.'
      : body.detail || body.file || `Request failed (HTTP ${response.status}).`));
  }
  return response.json();
}
