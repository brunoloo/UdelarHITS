async function loadCategory() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    alert("No se especificó una categoría");
    window.location.href = "../../testing/category-testing.html";
    return;
  }

  const [categoryResult, meResult] = await Promise.all([
    apiGet(`/categories/${id}`),
    apiGet("/users/me")
  ]);

  if (!categoryResult.ok) {
    alert(categoryResult.message || "Error al cargar la categoría");
    window.location.href = "../../testing/category-testing.html";
    return;
  }

  const c = categoryResult.data;
  const isAdmin = meResult.ok && meResult.data.user?.rol === 'admin';

  const categoryBody = document.querySelector("#categoryTable tbody");
  categoryBody.innerHTML = `
    ${isAdmin ? `<tr><th>ID</th><td>${c.id}</td></tr>` : ''}
    <tr><th>Título</th><td>${c.titulo}</td></tr>
    <tr><th>Descripción</th><td>${c.descripcion}</td></tr>
    <tr><th>Autor</th><td><a href="/src/user/profile.html?nickname=${encodeURIComponent(c.autor_nickname)}">${c.autor_nickname}</a></td></tr>
    <tr><th>Etiquetas</th><td>${Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : c.etiquetas || '-'}</td></tr>
    <tr><th>Temas</th><td>${c.contador_temas}</td></tr>
    <tr><th>Fecha de creación</th><td>${new Date(c.fecha_creacion).toLocaleString()}</td></tr>
  `;

  // Temas
  const topicsBody = document.querySelector("#topicsTable tbody");
  if (!c.topics || c.topics.length === 0) {
    topicsBody.innerHTML = `<tr><td colspan="3">Sin temas aún</td></tr>`;
  } else {
    c.topics.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.contenido_id}</td>
        <td><a href="/src/topic/topic.html?id=${t.contenido_id}">${t.titulo}</a></td>
        <td>${new Date(t.fecha_creacion).toLocaleString()}</td>
      `;
      topicsBody.appendChild(tr);
    });
  }

  // Comentarios
  const repliesBody = document.querySelector("#repliesTable tbody");
  const repliesResult = await apiGet(`/replies/category/${id}`);

  if (!repliesResult.ok || repliesResult.data.length === 0) {
    repliesBody.innerHTML = `<tr><td colspan="3">Sin comentarios aún</td></tr>`;
  } else {
    repliesResult.data.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.id}</td>
        <td><a href="/src/user/profile.html?nickname=${encodeURIComponent(r.autor_nickname)}">${r.autor_nickname}</a></td>
        <td>${r.cuerpo}</td>
      `;
      repliesBody.appendChild(tr);
    });
  }
}

loadCategory();