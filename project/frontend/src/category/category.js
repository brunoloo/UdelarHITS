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
  const etiquetasTxt = Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : (c.etiquetas || '-');
  categoryBody.innerHTML = `
    ${isAdmin ? `<tr><th>ID</th><td>${escapeHtml(c.id)}</td></tr>` : ''}
    <tr><th>Título</th><td>${escapeHtml(c.titulo)}</td></tr>
    <tr><th>Descripción</th><td>${escapeHtml(c.descripcion)}</td></tr>
    <tr><th>Autor</th><td><a href="/src/user/profile.html?nickname=${encodeURIComponent(c.autor_nickname)}">${escapeHtml(c.autor_nickname)}</a></td></tr>
    <tr><th>Etiquetas</th><td>${escapeHtml(etiquetasTxt)}</td></tr>
    <tr><th>Temas</th><td>${escapeHtml(c.contador_temas)}</td></tr>
    <tr><th>Fecha de creación</th><td>${escapeHtml(new Date(c.fecha_creacion).toLocaleString())}</td></tr>
  `;

  // Temas
  const topicsBody = document.querySelector("#topicsTable tbody");
  if (!c.topics || c.topics.length === 0) {
    topicsBody.innerHTML = `<tr><td colspan="3">Sin temas aún</td></tr>`;
  } else {
    c.topics.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(t.contenido_id)}</td>
        <td><a href="/src/topic/topic.html?id=${encodeURIComponent(t.contenido_id)}">${escapeHtml(t.titulo)}</a></td>
        <td>${escapeHtml(new Date(t.fecha_creacion).toLocaleString())}</td>
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
        <td>${escapeHtml(r.id)}</td>
        <td><a href="/src/user/profile.html?nickname=${encodeURIComponent(r.autor_nickname)}">${escapeHtml(r.autor_nickname)}</a></td>
        <td>${escapeHtml(r.cuerpo)}</td>
      `;
      repliesBody.appendChild(tr);
    });
  }
}

loadCategory();