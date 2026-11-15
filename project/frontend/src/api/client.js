const BASE = '/api'

async function request(method, path, body = null) {
  const options = {
    method,
    credentials: 'include',
    headers: {},
  }

  if (body instanceof FormData) {
    options.body = body
  } else if (body !== null) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, options)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Error del servidor')
  }

  return data
}

export const apiGet    = (path)        => request('GET',    path)
export const apiPost   = (path, body)  => request('POST',   path, body)
export const apiPatch  = (path, body)  => request('PATCH',  path, body)
export const apiPut    = (path, body)  => request('PUT',    path, body)
export const apiDelete = (path)        => request('DELETE', path)
