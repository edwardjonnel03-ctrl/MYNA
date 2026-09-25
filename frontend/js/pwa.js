if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(console.warn));
}
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event;
  const button = document.getElementById('maynaInstallButton');
  if (button) button.hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  const button = document.getElementById('maynaInstallButton');
  if (button) button.hidden = true;
});
document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('maynaInstallButton');
  if (!button) return;
  button.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    button.hidden = true;
  });
});
