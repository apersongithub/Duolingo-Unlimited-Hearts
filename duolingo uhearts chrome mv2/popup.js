document.getElementById("supportBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://buymeacoffee.com/aperson" });
});
