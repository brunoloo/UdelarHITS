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
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${escapeHtml(u.id)}</td>
    <td><a href="profile.html?nickname=${encodeURIComponent(u.nickname)}">${escapeHtml(u.nickname)}</a></td>
    <td>${escapeHtml(u.email)}</td>
  `;
  tableBody.appendChild(tr);
});
}

loadUsers();

