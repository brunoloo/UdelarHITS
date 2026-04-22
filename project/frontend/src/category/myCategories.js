const tableBody = document.querySelector("#myCategoriesTable tbody");

async function loadMyCategories() {
  const result = await apiGet("/categories/me");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "../../testing/category-testing.html";
    return;
  }

  tableBody.innerHTML = "";

  if (result.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">No tenés categorías creadas aún</td></tr>`;
    return;
  }

  result.data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><a href="category.html?id=${c.id}">${c.titulo}</a></td>
      <td>${Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : c.etiquetas || '-'}</td>
      <td>${c.estado}</td>
      <td>${c.estado === "activa"
        ? `<a href="updateCategory.html?id=${c.id}">Editar</a>`
        : `<span style="color: gray;">No podés editar categorías eliminadas</span>`
      }</td>
      <td><button class="btn-participantes" data-id="${c.id}">Ver</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

// Contenedor de participantes
const participantesContainer = document.createElement("div");
participantesContainer.id = "participantesContainer";
participantesContainer.style.cssText = "margin-top: 24px; display: none;";
participantesContainer.innerHTML = `
  <h2 id="participantesTitulo"></h2>
  <ul id="participantesList" style="list-style: none; padding: 0; margin-top: 12px;"></ul>
`;
document.querySelector("main").appendChild(participantesContainer);

tableBody.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("btn-participantes")) return;

  const id = e.target.dataset.id;
  const titulo = e.target.closest("tr").querySelector("td:nth-child(2)").textContent;

  const result = await apiGet(`/categories/${id}/participants`);

  const container = document.querySelector("#participantesContainer");
  const list = document.querySelector("#participantesList");
  const tituloEl = document.querySelector("#participantesTitulo");

  tituloEl.textContent = `Participantes de "${titulo}"`;
  list.innerHTML = "";

  if (!result.ok || result.data.length === 0) {
    list.innerHTML = `<li style="color: #666;">Sin participantes aún</li>`;
  } else {
    result.data.forEach(p => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="/src/user/user.html?nickname=${encodeURIComponent(p.nickname)}">${p.nickname}</a>`;
      li.style.padding = "4px 0";
      list.appendChild(li);
    });
  }

  container.style.display = "block";
  container.scrollIntoView({ behavior: "smooth" });
});

loadMyCategories();