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
    tr.innerHTML = `
      <td>${t.id}</td>
      <td><a href="/src/topic/topic.html?id=${t.id}">${t.titulo}</a></td>
      <td>${t.categoria_titulo}</td>
      <td>${t.estado}</td>
      <td>${t.estado === 'activo'
        ? `<a href="/src/topic/updateTopic.html?id=${t.id}">Editar</a>`
        : `<span style="color: gray;">Tema inactivo</span>`
      }</td>
    `;
    tableBody.appendChild(tr);
  });
}

loadMyTopics();