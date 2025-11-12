// public/src/script.ts
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      window.location.href = "./info.html";
    });
  }
});
