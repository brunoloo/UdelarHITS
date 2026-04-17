const createCategoryForm = document.getElementById("createCategoryForm");

if (createCategoryForm) {
  createCategoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titulo = createCategoryForm.querySelector('[name="titulo"]').value;
    const descripcion = createCategoryForm.querySelector('[name="descripcion"]').value;
    const etiquetas = Array.from(
      createCategoryForm.querySelectorAll('input[name="etiquetas"]:checked')
    ).map(cb => cb.value);

    if (!titulo?.trim()) {
      alert("El título es obligatorio");
      return;
    }
    if (!descripcion?.trim()) {
      alert("La descripción es obligatoria");
      return;
    }
    if (etiquetas.length === 0) {
      alert("Seleccioná al menos una etiqueta");
      return;
    }

    const result = await apiPost("/categories/create", { titulo, descripcion, etiquetas });

    if (result.ok) {
      alert("Categoría creada correctamente");
      createCategoryForm.reset();
    } else {
      alert(result.message || "Error desconocido");
    }
  });
}