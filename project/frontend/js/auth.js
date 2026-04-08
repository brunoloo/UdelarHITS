//Register
const registerForm = document.getElementById("registerForm");
if(registerForm){
    registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
        if (registerForm.password.value.length < 8) {
            alert("La contraseña debe tener al menos 8 caracteres");
            return;
        }

        const data = Object.fromEntries(new FormData(registerForm));

        const result = await apiPost("/auth/register", data);
        if (result.ok) {
            alert("Usuario creado correctamente");
            registerForm.reset()
        } else {
            alert(result.message || 'Error desconocido');
        }
    });
}
    
//Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));

    // enviar como email o nickname
    const body = {
      email: data.identifier,
      nickname: data.identifier,
      password: data.password
    };

    const result = await apiPost("/auth/login", body);
    alert(JSON.stringify(result));
    loginForm.reset()
    if (result.ok) {
      window.location.href = "/";
    } 
  });
}

//Logout
const logoutForm = document.getElementById("logoutBtn");
if (logoutForm) {
  logoutForm.addEventListener("click", async () => {
    const result = await apiPost("/auth/logout", {});
    if (result.ok) {
      alert(JSON.stringify(result));
      window.location.href = "/";
    } else {
      alert(result.message || "Error al cerrar sesión");
    }
  });
}