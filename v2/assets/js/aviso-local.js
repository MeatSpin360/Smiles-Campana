// Si la página se abre con doble clic (file://), los módulos de JavaScript no cargan.
// Este script común (no módulo) sí corre, y explica cómo abrirla bien.
(function () {
  if (location.protocol !== 'file:') return;
  document.addEventListener('DOMContentLoaded', function () {
    var aviso = document.createElement('div');
    aviso.setAttribute('role', 'alert');
    aviso.style.cssText = 'position:fixed;inset:auto 16px 16px;z-index:9999;max-width:560px;margin:0 auto;padding:16px 18px;' +
      'border-radius:14px;background:#262140;color:#fff;font:15px/1.5 system-ui,sans-serif;box-shadow:0 18px 50px -20px rgba(0,0,0,.5)';
    aviso.innerHTML = '<strong>Esta página se abrió como archivo suelto.</strong><br>' +
      'Así el navegador no ejecuta el código. Para probarla en tu PC, abrí la carpeta <code>v2</code> con un servidor local: ' +
      'en VS Code, clic derecho en <code>index.html</code> y <em>Open with Live Server</em>. Online funciona sin hacer nada.';
    document.body.appendChild(aviso);
    var app = document.getElementById('app');
    if (app) app.innerHTML = '';
  });
})();
