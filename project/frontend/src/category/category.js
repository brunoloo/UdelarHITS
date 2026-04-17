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
    <tr><th>Etiquetas</th><td>${Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : c.etiquetas || '-'}</td></tr>
    <tr><th>Estado</th><td>${c.estado}</td></tr>
    <tr><th>Temas</th><td>${c.contador_temas}</td></tr>
    <tr><th>Fecha de creación</th><td>${new Date(c.fecha_creacion).toLocaleString()}</td></tr>
  `;

  // Temas
  const topicsBody = document.querySelector("#topicsTable tbody");
  if (!c.topics || c.topics.length === 0) {
    topicsBody.innerHTML = `<tr><td colspan="4">Sin temas aún</td></tr>`;
    return;
  }

  c.topics.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.contenido_id}</td>
      <td>${t.titulo}</td>
      <td>${t.estado}</td>
      <td>${new Date(t.fecha_creacion).toLocaleString()}</td>
    `;
    topicsBody.appendChild(tr);
  });
}

loadCategory();