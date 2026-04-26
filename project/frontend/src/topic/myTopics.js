const tableBody = document.querySelector("#myTopicsTable tbody");

async function loadMyTopics() {
  const result = await apiGet("/topics/me");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "../../testing/topic-testing.html";
    return;
  }

  tableBody.innerHTML = "";

  if (result.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5">Sin temas aún</td></tr>`;
    return;
  }

  result.data.forEach(t => {
    const tr = document.createElement("tr");
    const editCell = t.estado === 'activo'
      ? `<a href="/src/topic/updateTopic.html?id=${encodeURIComponent(t.id)}">Editar</a>`
      : `<span style="color: gray;">No podés editar temas eliminados</span>`;
    tr.innerHTML = `
      <td>${escapeHtml(t.id)}</td>
      <td><a href="/src/topic/topic.html?id=${encodeURIComponent(t.id)}">${escapeHtml(t.titulo)}</a></td>
      <td>${escapeHtml(t.categoria_titulo)}</td>
      <td>${escapeHtml(t.estado)}</td>
      <td>${editCell}</td>
    `;
    tableBody.appendChild(tr);
  });
}

loadMyTopics();