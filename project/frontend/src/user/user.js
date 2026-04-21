const params = new URLSearchParams(window.location.search);
const nickname = params.get("nickname");

const userTableBody = document.querySelector("#userTable tbody");
const categoriesBody = document.querySelector("#categoriesTable tbody");
const topicsBody = document.querySelector("#topicsTable tbody");
const repliesBody = document.querySelector("#repliesTable tbody");
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
    window.history.back();
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

  // Categorías
  categoriesBody.innerHTML = "";
  if (!categories || categories.length === 0) {
    categoriesBody.innerHTML = `<tr><td colspan="4">Sin categorías aún</td></tr>`;
  } else {
    categories.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.id}</td>
        <td><a href="../category/category.html?id=${c.id}">${c.titulo}</a></td>
        <td>${Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : c.etiquetas || '-'}</td>
        <td>${new Date(c.fecha_creacion).toLocaleString()}</td>
      `;
      categoriesBody.appendChild(tr);
    });
  }

  // Temas
  const topicsResult = await apiGet(`/topics/user/${user.id}`);
  topicsBody.innerHTML = "";
  if (!topicsResult.ok || topicsResult.data.length === 0) {
    topicsBody.innerHTML = `<tr><td colspan="3">Sin temas aún</td></tr>`;
  } else {
    topicsResult.data.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.id}</td>
        <td><a href="../topic/topic.html?id=${t.id}">${t.titulo}</a></td>
        <td><a href="../category/category.html?id=${t.categoria_id}">${t.categoria_titulo}</a></td>
        <td>${new Date(t.fecha_creacion).toLocaleString()}</td>
      `;
      topicsBody.appendChild(tr);
    });
  }

  // Comentarios
  const repliesResult = await apiGet(`/replies/user/${user.id}`);
  repliesBody.innerHTML = "";
  if (!repliesResult.ok || repliesResult.data.length === 0) {
    repliesBody.innerHTML = `<tr><td colspan="4">Sin comentarios aún</td></tr>`;
  } else {
    repliesResult.data.forEach(r => {
      const tr = document.createElement("tr");
      
      const destinoLink = r.tipo === 'tema'
        ? `<a href="../topic/topic.html?id=${r.destino_id}">${r.destino_titulo}</a>`
        : `<a href="../category/category.html?id=${r.destino_id}">${r.destino_titulo}</a>`;
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.cuerpo}</td>
        <td>${destinoLink}</td>
        <td>${r.tipo}</td>
        <td>${new Date(r.fecha_creacion).toLocaleString()}</td>
      `;
      repliesBody.appendChild(tr);
    });
  }

  // Seguidores
  followersBody.innerHTML = "";
  if (!followers || followers.length === 0) {
    followersBody.innerHTML = `<tr><td colspan="3">Sin seguidores aún</td></tr>`;
  } else {
    followers.forEach(f => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.id}</td>
        <td>${f.nickname}</td>
        <td>${f.nombre}</td>
      `;
      followersBody.appendChild(tr);
    });
  }

  // Seguidos
  followingBody.innerHTML = "";
  if (!following || following.length === 0) {
    followingBody.innerHTML = `<tr><td colspan="3">Sin seguidos aún</td></tr>`;
  } else {
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
}

loadUser();