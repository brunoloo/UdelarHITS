const tableBody = document.querySelector("#myRepliesTable tbody");

async function loadMyReplies() {
  const result = await apiGet("/replies/me");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "/";
    return;
  }

  tableBody.innerHTML = "";

  if (result.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">Sin comentarios aún</td></tr>`;
    return;
  }

  result.data.forEach(r => {
    const tr = document.createElement("tr");

    const destinoLink =
      r.tipo === 'tema'
        ? `<a href="../topic/topic.html?id=${r.destino_id}">${r.destino_titulo}</a>`
        : `<a href="../category/category.html?id=${r.destino_id}">${r.destino_titulo}</a>`;
    tr.innerHTML = `
      <td>${r.cuerpo}</td>
      <td>${destinoLink}</td>
      <td>${r.tipo}</td>
      <td>${new Date(r.fecha_creacion).toLocaleString()}</td>
      <td><a href="../reply/updateReply.html?id=${r.id}">Editar</a></td>
      <td><button class="btn-eliminar" data-id="${r.id}">Eliminar</button></td>
    `;

    tableBody.appendChild(tr);
  });
}

tableBody.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-eliminar')) return;

  const id = e.target.dataset.id;
  const confirmado = confirm('¿Seguro que querés eliminar este comentario? Esta acción es irreversible.');
  if (!confirmado) return;

  const result = await apiDelete(`/replies/delete/${id}`);

  if (result.ok) {
    loadMyReplies();
  } else {
    alert(result.message || "Error al eliminar");
  }
});

loadMyReplies();