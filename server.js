// ============================================================
// Servidor Local — La Casa de Pastel
// ============================================================
// Uso: npm start
// O PDV ficará em http://localhost:3000/pdv/
// O site do cliente ficará em http://localhost:3000/cliente/
// ============================================================

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve todos os arquivos estáticos da raiz do projeto
app.use(express.static(path.join(__dirname), {
    // Cache leve para assets estáticos
    maxAge: '1h',
    // Permite que o service worker funcione
    setHeaders: (res, filePath) => {
        // Desabilita cache para HTML (sempre pega a versão mais recente)
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Rota de status para verificar se o servidor está rodando
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Redireciona a raiz para o PDV
app.get('/', (req, res) => {
    res.redirect('/pdv/');
});

// Inicia o servidor
app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║    🏪 La Casa de Pastel — Servidor      ║');
    console.log('  ╠══════════════════════════════════════════╣');
    console.log(`  ║  PDV:     ${url}/pdv/          ║`);
    console.log(`  ║  Cliente: ${url}/cliente/      ║`);
    console.log('  ╠══════════════════════════════════════════╣');
    console.log('  ║  Status: ✅ Servidor ativo              ║');
    console.log('  ║  Ctrl+C para encerrar                   ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');

    // Abre o PDV no navegador automaticamente apenas se não estiver rodando no Electron
    if (!process.env.IS_ELECTRON && !process.versions.electron) {
        import('open').then(mod => mod.default(url + '/pdv/')).catch(() => {
            console.log(`  Abra manualmente: ${url}/pdv/`);
        });
    } else {
        console.log(`  Rodando no App Desktop: ${url}/pdv/`);
    }
});
