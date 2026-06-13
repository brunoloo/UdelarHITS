const tableBody = document.querySelector("#usersTable tbody");

async function loadUsers() {
  const result = await apiGet("/users/");

  if (!result.ok) {
    alert(result.message || "No autorizado");
    window.location.href = "/testing/user-testing.html"; 
    return;
  }

  tableBody.innerHTML = "";

  result.data.forEach(u => {
  console.log(result.data[0])
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${escapeHtml(u.id)}</td>
    <td><a href="/testing/user-testing/user.html?nickname=${encodeURIComponent(u.nickname)}">${escapeHtml(u.nickname)}</a></td>
    <td>${escapeHtml(u.email)}</td>
    <td>
      ${u.estado === 'activo'
        ? `<button class="btn-suspender" data-nickname="${escapeAttr(u.nickname)}">Suspender</button>`
        : `<button class="btn-reactivar" data-nickname="${escapeAttr(u.nickname)}">Activar</button>`
      }
    </td>
  `;
  tableBody.appendChild(tr);
});
}

tableBody.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-suspender')) return;

  const nickname = e.target.dataset.nickname;

  const confirmado = confirm(`¿Seguro que querés suspender la cuenta "${nickname}"?.`);
  if (!confirmado) return;

  const result = await apiPatch(`/users/${nickname}/ban`);

  if (result.ok) {
    loadUsers();
  } else {
    alert(result.message || "Error al suspender");
  }
});

tableBody.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-reactivar')) return;

  const nickname = e.target.dataset.nickname;

  const confirmado = confirm(`¿Seguro que querés activar la cuenta "${nickname}"?.`);
  if (!confirmado) return;

  const result = await apiPatch(`/users/${nickname}/active`);

  if (result.ok) {
    loadUsers();
  } else {
    alert(result.message || "Error al reactivar");
  }
});

loadUsers();

