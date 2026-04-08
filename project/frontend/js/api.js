const API = "http://localhost:5001/api";

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include"
  });
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, {
    method: "GET",
    credentials: "include"
  });
  return res.json();
}