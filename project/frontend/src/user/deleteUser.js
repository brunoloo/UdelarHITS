const tableBody = document.querySelector("#usersTable tbody");

async function loadUsers() {
  const result = await apiGet("/users/");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "../../testing/user-testing.html"; 
    return;
  }

  tableBody.innerHTML = "";

  result.data.forEach(u => {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${u.id}</td>
    <td><a href="user.html?nickname=${encodeURIComponent(u.nickname)}">${u.nickname}</a></td>
    <td>${u.email}</td>
    <td>
    <button class="delete-btn" data-nickname="${u.nickname}">
        Eliminar
    </button>
    </td>
  `;
  tableBody.appendChild(tr);
});

    document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
        const nickname = btn.dataset.nickname;

        const confirmDelete = confirm(`¿Eliminar usuario: ${nickname}?`);
        if (!confirmDelete) return;

        const result = await apiDelete(`/users/${nickname}/delete`);

        if (result.ok) {
        alert("Usuario eliminado correctamente");
        loadUsers(); // recarga tabla
        } else {
        alert(result.message || "Error al eliminar");
        }
    });
    });
}


loadUsers();

