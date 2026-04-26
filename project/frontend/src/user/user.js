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
    <tr><td>ID</td><td>${escapeHtml(user.id)}</td></tr>
    <tr><td>Nickname</td><td>${escapeHtml(user.nickname)}</td></tr>
    <tr><td>Nombre</td><td>${escapeHtml(user.nombre)}</td></tr>
    <tr><td>Email</td><td>${escapeHtml(user.email)}</td></tr>
    <tr><td>Rol</td><td>${escapeHtml(user.rol)}</td></tr>
    <tr><td>Biografía</td><td>${escapeHtml(user.biografia || "")}</td></tr>
  `;

  // Categorías
  categoriesBody.innerHTML = "";
  if (!categories || categories.length === 0) {
    categoriesBody.innerHTML = `<tr><td colspan="4">Sin categorías aún</td></tr>`;
  } else {
    categories.forEach(c => {
      const tr = document.createElement("tr");
      const etiquetasTxt = Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : (c.etiquetas || '-');
      tr.innerHTML = `
        <td>${escapeHtml(c.id)}</td>
        <td><a href="../category/category.html?id=${encodeURIComponent(c.id)}">${escapeHtml(c.titulo)}</a></td>
        <td>${escapeHtml(etiquetasTxt)}</td>
        <td>${escapeHtml(new Date(c.fecha_creacion).toLocaleString())}</td>
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
        <td>${escapeHtml(t.id)}</td>
        <td><a href="../topic/topic.html?id=${encodeURIComponent(t.id)}">${escapeHtml(t.titulo)}</a></td>
        <td><a href="../category/category.html?id=${encodeURIComponent(t.categoria_id)}">${escapeHtml(t.categoria_titulo)}</a></td>
        <td>${escapeHtml(new Date(t.fecha_creacion).toLocaleString())}</td>
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
        ? `<a href="../topic/topic.html?id=${encodeURIComponent(r.destino_id)}">${escapeHtml(r.destino_titulo)}</a>`
        : `<a href="../category/category.html?id=${encodeURIComponent(r.destino_id)}">${escapeHtml(r.destino_titulo)}</a>`;
      tr.innerHTML = `
        <td>${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.cuerpo)}</td>
        <td>${destinoLink}</td>
        <td>${escapeHtml(r.tipo)}</td>
        <td>${escapeHtml(new Date(r.fecha_creacion).toLocaleString())}</td>
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
        <td>${escapeHtml(f.id)}</td>
        <td>${escapeHtml(f.nickname)}</td>
        <td>${escapeHtml(f.nombre)}</td>
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
        <td>${escapeHtml(f.id)}</td>
        <td>${escapeHtml(f.nickname)}</td>
        <td>${escapeHtml(f.nombre)}</td>
      `;
      followingBody.appendChild(tr);
    });
  }
}

loadUser();