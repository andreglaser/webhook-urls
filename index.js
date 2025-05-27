const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

// Middleware para parsing JSON
app.use(express.json());

// Rota para capturar URL final
app.post('/get-final-url', async (req, res) => {
  let browser;
  
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    
    console.log(`Processando URL: ${url}`);
    
    // Array para armazenar todos os redirecionamentos
    const redirects = [];
    let finalUrl = '';
    let searchUrl = ''; // URL com parâmetros de busca (antes do login)
    
    // Inicializar Puppeteer com configurações para Render
    browser = await puppeteer.launch({ 
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || await puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Interceptar requisições para capturar redirecionamentos
    page.on('response', async (response) => {
      const status = response.status();
      const responseUrl = response.url();
      
      // Capturar redirecionamentos HTTP (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(status)) {
        const location = response.headers()['location'];
        if (location) {
          redirects.push({
            from: responseUrl,
            to: location,
            status: status,
            type: 'HTTP'
          });
          
          console.log(`Redirect HTTP ${status}: ${responseUrl} -> ${location}`);
          
          // Se a URL contém parâmetros de busca e não é login, salvar como searchUrl
          if (location.includes('search') || location.includes('booking') || location.includes('flight') || 
              (location.includes('?') && !location.includes('login') && !location.includes('signin'))) {
            searchUrl = location;
          }
        }
      }
    });
    
    // Interceptar navegações JavaScript
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        const newUrl = frame.url();
        if (redirects.length === 0 || redirects[redirects.length - 1].to !== newUrl) {
          redirects.push({
            from: redirects.length > 0 ? redirects[redirects.length - 1].to : url,
            to: newUrl,
            status: 'JS',
            type: 'JavaScript'
          });
          
          console.log(`Redirect JS: -> ${newUrl}`);
          
          // Se a URL contém parâmetros de busca e não é login, salvar como searchUrl
          if (newUrl.includes('search') || newUrl.includes('booking') || newUrl.includes('flight') || 
              (newUrl.includes('?') && !newUrl.includes('login') && !newUrl.includes('signin'))) {
            searchUrl = newUrl;
          }
        }
      }
    });
    
    // Navegar para a URL
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Aguardar um pouco mais para garantir que redirects JavaScript executem
    await page.waitForTimeout(5000);
    
    // Capturar URL final
    finalUrl = page.url();
    
    console.log(`URL final: ${finalUrl}`);
    console.log(`URL de busca (com parâmetros): ${searchUrl}`);
    
    await browser.close();
    
    // Determinar a melhor URL para retornar
    let bestUrl = finalUrl;
    
    // Se temos uma URL de busca válida e a final é de login, usar a de busca
    if (searchUrl && (finalUrl.includes('login') || finalUrl.includes('signin') || finalUrl.includes('auth'))) {
      bestUrl = searchUrl;
    }
    
    // Retornar resultado
    res.json({ 
      success: true,
      originalUrl: url,
      finalUrl: finalUrl,
      searchUrl: searchUrl || null,
      recommendedUrl: bestUrl,
      redirects: redirects,
      totalRedirects: redirects.length,
      isLoginPage: finalUrl.includes('login') || finalUrl.includes('signin') || finalUrl.includes('auth')
    });
    
  } catch (error) {
    console.error('Erro:', error.message);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Rota de teste
app.get('/test', (req, res) => {
  res.json({ message: 'Webhook funcionando!', timestamp: new Date().toISOString() });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Webhook URL Scraper', 
    endpoints: {
      test: 'GET /',
      scrape: 'POST /get-final-url'
    }
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;