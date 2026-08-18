document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const error = document.getElementById("loginError");

  if (username === "admin" && password === "admin123") {
    sessionStorage.setItem("helpdesksystem.admin", "true");
    window.location.href = "index.html";
    return;
  }

  error.hidden = false;
});
