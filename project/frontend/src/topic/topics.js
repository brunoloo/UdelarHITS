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
      <td>${t.id}</td>
      <td><a href="/src/user/profile.html?nickname=${encodeURIComponent(t.autor_nickname)}">${t.autor_nickname}</a></td>
      <td><a href="/src/topic/topic.html?id=${t.id}">${t.titulo}</a></td>
      <td>${t.estado}</td>
      <td><button class="btn-eliminar" data-id="${t.id}" data-titulo="${t.titulo}">Eliminar</button></td>
      <td><button class="btn-activar" data-id="${t.id}" data-titulo="${t.titulo}">Activar</button></td>
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
    const result = await apiPatch(`/topics/${id}/delete`);
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