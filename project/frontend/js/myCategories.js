const tableBody = document.querySelector("#myCategoriesTable tbody");

async function loadMyCategories() {
  const result = await apiGet("/categories/me");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "/testing/category-testing.html";
    return;
  }

  tableBody.innerHTML = "";

  if (result.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5">No tenés categorías creadas aún</td></tr>`;
    return;
  }

  result.data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><a href="/html/category.html?id=${c.id}">${c.titulo}</a></td>
      <td>${Array.isArray(c.etiquetas) ? c.etiquetas.join(', ') : c.etiquetas || '-'}</td>
      <td>${c.estado}</td>
      <td>
  ${
      c.estado === "activa"
      ? `<a class="btn-eliminar" href="/html/updateCategory.html?id=${c.id}">Editar</a>`
      : `<span style="color: gray;">No podés editar categorías eliminadas</span>`
  }
</td>
    `;
    tableBody.appendChild(tr);
  });
}

// codigo acá

loadMyCategories();