const createTopicForm = document.getElementById("createTopicForm");

async function loadCategories() {
  const result = await apiGet("/categories/active");
  if (!result.ok) return;

  const select = createTopicForm.querySelector('[name="categoria_id"]');
  result.data.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.titulo;
    select.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadCategories();

  createTopicForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titulo = createTopicForm.querySelector('[name="titulo"]').value;
    const cuerpo = createTopicForm.querySelector('[name="cuerpo"]').value;
    const categoria_id = createTopicForm.querySelector('[name="categoria_id"]').value;

    if (!titulo?.trim()) {
      alert("El título es obligatorio");
      return;
    }
    if (!cuerpo?.trim()) {
      alert("El contenido es obligatorio");
      return;
    }
    if (!categoria_id) {
      alert("Seleccioná una categoría");
      return;
    }

    const result = await apiPost("/topics/create", { titulo, cuerpo, categoria_id });

    if (result.ok) {
      alert("Tema creado correctamente");
      createTopicForm.reset();
    } else {
      alert(result.message || "Error desconocido");
    }
  });
});