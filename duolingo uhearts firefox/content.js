(async () => {
  const response = await fetch("https://raw.githubusercontent.com/apersongithub/private2/refs/heads/main/patched-app.js");
  const code = await response.text();
  const script = document.createElement("script");
  script.textContent = code;
  document.head.appendChild(script);
})();
