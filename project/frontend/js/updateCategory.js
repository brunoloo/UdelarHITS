let currentCategory = {};

async function loadCategory() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    alert("No se especificó una categoría");
    window.location.href = "/html/myCategories.html";
    return;
  }

const result = await apiGet(`/categories/${id}`);

  if (!result.ok) {
    alert(result.message || "Error al cargar la categoría");
    window.location.href = "/html/myCategories.html";
    return;
  }

  const c = result.data;
  currentCategory = c;

  document.querySelector("#categoryTitulo").textContent = c.titulo;
  document.querySelector("#categoryDescripcion").textContent = c.descripcion;

  // Marcar etiquetas actuales
  const etiquetasActuales = Array.isArray(c.etiquetas) ? c.etiquetas : c.etiquetas?.replace(/[{}]/g, '').split(',').map(e => e.trim().replace(/"/g, ''));
  document.querySelectorAll("#etiquetasContainer input[type='checkbox']").forEach(cb => {
    cb.checked = etiquetasActuales.includes(cb.value);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadCategory();

  // Lápiz descripción
  document.querySelector(".edit-btn[data-field='descripcion']").addEventListener("click", () => {
    const p = document.querySelector("#categoryDescripcion");
    const input = document.querySelector("#inputDescripcion");
    const isEditing = input.style.display !== "none";
    if (isEditing) {
      p.textContent = input.value || currentCategory.descripcion;
      input.style.display = "none";
      p.style.display = "";
    } else {
      input.value = p.textContent;
      input.style.display = "";
      p.style.display = "none";
      input.focus();
    }
  });

  // Confirmar
  document.querySelector("#confirmBtn").addEventListener("click", async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    const inputDescripcion = document.querySelector("#inputDescripcion");
    const etiquetas = Array.from(
      document.querySelectorAll("#etiquetasContainer input[type='checkbox']:checked")
    ).map(cb => cb.value);

    const body = {};

    body.descripcion = inputDescripcion.style.display !== "none"
      ? inputDescripcion.value.trim()
      : currentCategory.descripcion;

    if (etiquetas.length === 0) {
      alert("Seleccioná al menos una etiqueta");
      return;
    }

    body.etiquetas = etiquetas;

    if (!body.descripcion?.trim()) {
      alert("La descripción no puede estar vacía");
      return;
    }

    const result = await apiPatch(`/categories/${id}`, body);

    if (result.ok) {
      alert("Categoría actualizada correctamente");
      window.location.href = "/html/myCategories.html";
    } else {
      alert(result.message || "Error al actualizar");
    }
  });

 document.querySelector("#eliminarBtn").addEventListener("click", async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
        alert("No se especificó una categoría");
        window.location.href = "/html/myCategories.html";
        return;
    }

    const confirmado = confirm('Seguro quieres eliminar esta categoría?');
    if (!confirmado) return;

    const result = await apiPatch(`/categories/${id}/delete`);
    if(result.ok){
      alert("Categoría eliminada correctamente");
      window.location.href = "/html/myCategories.html";
    }else {
       alert(result.message || "Error al eliminar"); 
    }
 });


});