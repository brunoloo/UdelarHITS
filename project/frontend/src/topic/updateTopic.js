let currentTopic = {};

async function loadTopic() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    alert("No se especificó un tema");
    window.location.href = "/src/topic/myTopics.html";
    return;
  }

  const result = await apiGet(`/topics/${id}`);

  if (!result.ok) {
    alert(result.message || "Error al cargar el tema");
    window.location.href = "/src/topic/myTopics.html";
    return;
  }

  const t = result.data;
  currentTopic = t;

  document.querySelector("#topicTitulo").textContent = t.titulo;
  document.querySelector("#topicCategoria").textContent = t.categoria_titulo;
  document.querySelector("#topicCuerpo").textContent = t.cuerpo;
}

document.addEventListener("DOMContentLoaded", () => {
  loadTopic();

  document.querySelector(".edit-btn[data-field='cuerpo']").addEventListener("click", () => {
    const p = document.querySelector("#topicCuerpo");
    const input = document.querySelector("#inputCuerpo");
    const isEditing = input.style.display !== "none";
    if (isEditing) {
      p.textContent = input.value || currentTopic.cuerpo;
      input.style.display = "none";
      p.style.display = "";
    } else {
      input.value = p.textContent;
      input.style.display = "";
      p.style.display = "none";
      input.focus();
    }
  });

  document.querySelector("#confirmBtn").addEventListener("click", async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    const inputCuerpo = document.querySelector("#inputCuerpo");

    const cuerpo = inputCuerpo.style.display !== "none"
      ? inputCuerpo.value.trim()
      : currentTopic.cuerpo;

    if (!cuerpo) {
      alert("El contenido no puede estar vacío");
      return;
    }

    const result = await apiPatch(`/topics/${id}`, { cuerpo });

    if (result.ok) {
      alert("Tema actualizado correctamente");
      window.location.href = "/src/topic/myTopics.html";
    } else {
      alert(result.message || "Error al actualizar");
    }
  });

  document.querySelector("#eliminarBtn").addEventListener("click", async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
        alert("No se especificó un tema");
        window.location.href = "myTopics.html";
        return;
    }

    const confirmado = confirm('Seguro quieres eliminar este tema?');
    if (!confirmado) return;

    const result = await apiPatch(`/topics/${id}/delete`);
    if(result.ok){
      alert("Tema eliminado correctamente");
      window.location.href = "myTopics.html";
    }else {
       alert(result.message || "Error al eliminar"); 
    }
 });

});