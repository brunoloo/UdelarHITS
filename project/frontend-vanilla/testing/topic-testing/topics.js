const tableBody = document.querySelector("#topicsTable tbody");

async function loadTopics() {
  const result = await apiGet("/topics/");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "../../testing/topic-testing.html";
    return;
  }

  tableBody.innerHTML = "";

  if (result.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">Sin temas aún</td></tr>`;
    return;
  }

  result.data.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.id)}</td>
      <td><a href="/testing/user-testing/user.html?nickname=${encodeURIComponent(t.autor_nickname)}">${escapeHtml(t.autor_nickname)}</a></td>
      <td><a href="/testing/topic-testing/topic.html?id=${encodeURIComponent(t.id)}">${escapeHtml(t.titulo)}</a></td>
      <td><a href="/testing/category-testing/category.html?id=${encodeURIComponent(t.categoria_id)}">implementar (hay un bug)</a></td>
      <td>${escapeHtml(t.estado)}</td>
      <td><button class="btn-eliminar" data-id="${escapeAttr(t.id)}" data-titulo="${escapeAttr(t.titulo)}">Eliminar</button></td>
      <td><button class="btn-activar" data-id="${escapeAttr(t.id)}" data-titulo="${escapeAttr(t.titulo)}">Activar</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

// listeners registrados una sola vez
tableBody.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-eliminar')) {
    const id = e.target.dataset.id;
    const titulo = e.target.dataset.titulo;
    const confirmado = confirm(`¿Seguro que querés eliminar el tema "${titulo}"?`);
    if (!confirmado) return;
    const result = await apiDelete(`/topics/${id}/delete`);
    if (result.ok) {
      loadTopics();
    } else {
      alert(result.message || "Error al eliminar");
    }
  }

  if (e.target.classList.contains('btn-activar')) {
    const id = e.target.dataset.id;
    const titulo = e.target.dataset.titulo;
    const result = await apiPatch(`/topics/${id}/active`);
    if (result.ok) {
      loadTopics();
    } else {
      alert(result.message || "Error al activar");
    }
  }
});

loadTopics();