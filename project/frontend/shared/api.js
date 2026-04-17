const API = "http://localhost:5001/api";

async function apiRequest(method, path, body) {
  const options = {
    method,
    credentials: "include"
  };

  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API}${path}`, options);
  return res.json();
}

async function apiGet(path) {
  return apiRequest("GET", path);
}

async function apiPost(path, body) {
  return apiRequest("POST", path, body);
}

async function apiPut(path, body) {
  return apiRequest("PUT", path, body);
}

async function apiPatch(path, body) {
  return apiRequest("PATCH", path, body);
}

async function apiDelete(path, body) {
  return apiRequest("DELETE", path, body);
}

async function apiUpdate(path, body) {
  return apiPut(path, body);
}