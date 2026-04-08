console.log("HREF:", window.location.href);
console.log("SEARCH RAW:", window.location.search);

const params = new URLSearchParams(window.location.search);

for (const [key, value] of params.entries()) {
  console.log("PARAM:", key, value);
}

const nickname = window.location.hash.replace("#nickname=", "");
console.log("NICKNAME:", nickname);

const userTableBody = document.querySelector("#userTable tbody");
const categoriesBody = document.querySelector("#categoriesTable tbody");
const followersBody = document.querySelector("#followersTable tbody");
const followingBody = document.querySelector("#followingTable tbody");

async function loadUser() {
  if (!nickname) {
    alert("Falta nickname");
    return;
  }

  const result = await apiGet(`/users/${encodeURIComponent(nickname)}`);

  if (!result.ok) {
    alert(result.message || "No autorizado");
    return;
  }

  const { user, categories, followers, following } = result.data;

  userTableBody.innerHTML = `
    <tr><td>ID</td><td>${user.id}</td></tr>
    <tr><td>Nickname</td><td>${user.nickname}</td></tr>
    <tr><td>Nombre</td><td>${user.nombre}</td></tr>
    <tr><td>Email</td><td>${user.email}</td></tr>
    <tr><td>Rol</td><td>${user.rol}</td></tr>
    <tr><td>Biografía</td><td>${user.biografia || ""}</td></tr>
  `;

  categoriesBody.innerHTML = "";
  categories.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.titulo}</td>
      <td>${c.etiqueta}</td>
      <td>${new Date(c.fecha_creacion).toLocaleString()}</td>
    `;
    categoriesBody.appendChild(tr);
  });

  followersBody.innerHTML = "";
  followers.forEach(f => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.id}</td>
      <td>${f.nickname}</td>
      <td>${f.nombre}</td>
    `;
    followersBody.appendChild(tr);
  });

  followingBody.innerHTML = "";
  following.forEach(f => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.id}</td>
      <td>${f.nickname}</td>
      <td>${f.nombre}</td>
    `;
    followingBody.appendChild(tr);
  });
}

loadUser();