export async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch('/api' + path, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed. Try again.'), { status: res.status });
  return data;
}
