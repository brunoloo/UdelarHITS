const tableBody = document.querySelector("#categoriesTable tbody");

async function loadCategories() {
  const result = await apiGet("/categories/");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "../../testing/category-testing.html";
    return;
  }

  tableBody.innerHTML = "";

  result.data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><a href="/src/user/profile.html?nickname=${encodeURIComponent(c.autor_nickname)}">${c.autor_nickname}</a></td>
      <td><a href="category.html?id=${c.id}">${c.titulo}</a></td>
      <td>${Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : c.etiquetas || '-'}</td>
      <td>${c.estado}</td>
      <td><button class="btn-eliminar" data-id="${c.id}" data-titulo="${c.titulo}">Eliminar</button></td>
      <td><button class="btn-activar" data-id="${c.id}" data-titulo="${c.titulo}">Activar</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

tableBody.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-eliminar')) return;

  const id = e.target.dataset.id;
  const titulo = e.target.dataset.titulo;

  const confirmado = confirm(`¿Seguro que querés eliminar la categoría "${titulo}"? Esta acción la marcará como inactiva.`);
  if (!confirmado) return;

  const result = await apiPatch(`/categories/${id}/delete`);

  if (result.ok) {
    loadCategories();
  } else {
    alert(result.message || "Error al eliminar");
  }
});

tableBody.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-activar')) return;

  const id = e.target.dataset.id;
  const titulo = e.target.dataset.titulo;

  const result = await apiPatch(`/categories/${id}/activar`);

  if (result.ok) {
    loadCategories();
  } else {
    alert(result.message || "Error al activar");
  }
});

loadCategories();