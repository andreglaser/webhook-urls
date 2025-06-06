const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const app = express();

// Middleware para parsing JSON
app.use(express.json());

// Contador de requisições para rotação de IP
let requestCount = 0;

// Função para verificar se o proxy está funcionando
async function checkProxyStatus() {
  try {
    console.log('Verificando status do proxy...');
    const testResponse = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      timeout: 5000
    });
    
    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log('Proxy funcionando - IP:', data.origin);
      return true;
    } else {
      console.log('Proxy com problemas - status:', testResponse.status);
      return false;
    }
  } catch (error) {
    console.log('Proxy down - erro:', error.message);
    return false;
  }
}

// Função para rotacionar IP do proxy móvel
async function rotateProxyIP() {
  try {
    console.log('Rotacionando IP do proxy móvel...');
    const response = await fetch('https://i.fxdx.in/api-rt/changeip/PbAilm0y2T/xTBMYKNFP45TBFYBRXSPH', {
      method: 'GET',
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('IP rotacionado com sucesso!');
      // Aguardar um pouco para o IP se estabilizar
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    } else {
      console.log('Erro ao rotacionar IP:', response.status);
      return false;
    }
  } catch (error) {
    console.log('Erro na rotação de IP:', error.message);
    return false;
  }
}

// Rota para capturar URL final
app.post('/get-final-url', async (req, res) => {
  let browser;
  
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    
    // Incrementar contador de requisições
    requestCount++;
    console.log(`Processando URL: ${url} (Requisição #${requestCount})`);
    
    // Rotacionar IP a cada 5 requisições
    if (requestCount % 5 === 1 && requestCount > 1) {
      console.log('Chegou na 5ª requisição - rotacionando IP...');
      await rotateProxyIP();
    }
    
    // Verificar status do proxy
    let proxyWorking = await checkProxyStatus();
    
    // Se proxy estiver DOWN, tentar rotacionar IP para reativar
    if (!proxyWorking) {
      console.log('Proxy DOWN - tentando rotacionar IP para reativar...');
      const rotationSuccess = await rotateProxyIP();
      
      if (rotationSuccess) {
        // Aguardar um pouco após rotação e testar novamente
        await new Promise(resolve => setTimeout(resolve, 3000));
        proxyWorking = await checkProxyStatus();
        
        if (proxyWorking) {
          console.log('Proxy reativado com sucesso após rotação!');
        } else {
          console.log('Proxy continua DOWN mesmo após rotação');
        }
      } else {
        console.log('Falha na rotação do IP');
      }
    }
    
    console.log(`Status final do proxy: ${proxyWorking ? 'FUNCIONANDO' : 'DOWN'}`);
    
    // Array para armazenar todos os redirecionamentos
    const redirects = [];
    let finalUrl = '';
    let searchUrl = ''; // URL com parâmetros de busca (antes do login)
    let maxRedirectsReached = false;
    
    // Configurar argumentos do browser baseado no status do proxy
    let browserArgs = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process',
      '--no-zygote',
      '--disable-gpu'
    ];
    
    // Adicionar proxy apenas se estiver funcionando
    if (proxyWorking) {
      browserArgs.push('--proxy-server=http://x166.fxdx.in:14941');
      console.log('Usando proxy móvel');
    } else {
      console.log('Usando conexão direta (sem proxy)');
    }
    
    // Inicializar Puppeteer com @sparticuz/chromium + proxy dinâmico
    browser = await puppeteer.launch({
      args: browserArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      timeout: 60000,
    });
    
    const page = await browser.newPage();
    
    // Autenticar no proxy apenas se estiver usando proxy
    if (proxyWorking) {
      await page.authenticate({
        username: 'andreglaser182020',
        password: '3865086'
      });
    }
    
    // Randomizar User-Agent entre diferentes iPhones
    const userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16.6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17.0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16.7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.7 Mobile/15E148 Safari/604.1'
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUA);
    
    // Mascarar propriedades do Puppeteer
    await page.evaluateOnNewDocument(() => {
      // Remover traces de webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mascarar chrome runtime
      if (window.chrome && window.chrome.runtime) {
        delete window.chrome.runtime;
      }
      
      // Adicionar propriedades de dispositivo real
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Randomizar canvas fingerprint
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type) {
        if (type === '2d') {
          const context = getContext.call(this, type);
          const getImageData = context.getImageData;
          context.getImageData = function(sx, sy, sw, sh) {
            const imageData = getImageData.call(this, sx, sy, sw, sh);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] += Math.floor(Math.random() * 10) - 5;
              imageData.data[i + 1] += Math.floor(Math.random() * 10) - 5;
              imageData.data[i + 2] += Math.floor(Math.random() * 10) - 5;
            }
            return imageData;
          };
          return context;
        }
        return getContext.call(this, type);
      };
    });
    
    // Configurar headers EXATOS do seu navegador
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Priority': 'u=0, i'
    });
    
    // Configurar viewport para simular iPhone
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    });
    
    // Configurar cookies essenciais baseados no seu navegador
    await page.setCookie(
      {
        name: 'prli_visitor',
        value: '67461f4c538f4',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'pys_start_session',
        value: 'true',
        domain: '.alertadevoos.com.br', 
        path: '/'
      },
      {
        name: 'pbid',
        value: 'db3afd0ab401e70c16648e72321439e154027a16ada016924fdffb19dfccc5fa',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: '_ga',
        value: 'GA1.1.417006033.1733451652',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: '_ga_N938CQSCV7',
        value: 'GS1.1.1740611487.7.1.1740611512.0.0.0',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_27459',
        value: 'nupr',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_27474',
        value: 'es11',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: '_gcl_au',
        value: '1.1.173014227.1748299805',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_29967',
        value: 'xb4n',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_29977',
        value: 'y5tl',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_30035',
        value: '2uwb',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_29864',
        value: 'rfq6',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: 'prli_click_30069',
        value: '84lt',
        domain: '.alertadevoos.com.br',
        path: '/'
      },
      {
        name: '_ga_4GHTCC9GZW',
        value: 'GS2.1.s1748396082$o20$g1$t1748396131$j11$l0$h0',
        domain: '.alertadevoos.com.br',
        path: '/'
      }
    );
    
    // Interceptar requisições para capturar redirecionamentos
    page.on('response', async (response) => {
      const status = response.status();
      const responseUrl = response.url();
      
      // Log detalhado para debug
      console.log(`Response: ${status} - ${responseUrl}`);
      
      // Capturar redirecionamentos HTTP (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(status)) {
        // Parar se já atingiu o limite de redirects
        if (redirects.length >= 5) {
          console.log('LIMITE DE 5 REDIRECTS ATINGIDO - Parando');
          maxRedirectsReached = true;
          return;
        }
        
        const location = response.headers()['location'];
        if (location) {
          redirects.push({
            from: responseUrl,
            to: location,
            status: status,
            type: 'HTTP',
            headers: response.headers()
          });
          
          console.log(`Redirect HTTP ${status}: ${responseUrl} -> ${location}`);
          
          // Se a URL contém parâmetros de busca e não é login, salvar como searchUrl
          if ((location.includes('search') || 
               location.includes('booking') || 
               location.includes('flight') || 
               location.includes('oferta-voos') || 
               location.includes('latam') || 
               location.includes('gol') ||
               location.includes('voeazul') ||
               location.includes('smiles') ||
               (location.includes('?') && !location.includes('login') && !location.includes('signin'))) &&
               !location.includes('login')) {
            searchUrl = location;
            console.log(`Search URL encontrada: ${location}`);
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
          if ((newUrl.includes('search') || 
               newUrl.includes('booking') || 
               newUrl.includes('flight') || 
               newUrl.includes('oferta-voos') || 
               newUrl.includes('latam') || 
               newUrl.includes('gol') ||
               newUrl.includes('voeazul') ||
               newUrl.includes('smiles') ||
               (newUrl.includes('?') && !newUrl.includes('login') && !newUrl.includes('signin'))) &&
               !newUrl.includes('login')) {
            searchUrl = newUrl;
          }
        }
      }
    });
    
    // Navegar para a URL com timeout otimizado
    try {
      // Iniciar navegação
      page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      }).catch(() => {
        // Ignorar erros de navegação quando interrompemos
        console.log('Navegação interrompida - normal');
      });
      
      // Aguardar até capturar pelo menos 2 redirects OU 6 segundos máximo (mais tempo para parecer humano)
      let redirectCount = 0;
      const startTime = Date.now();
      
      while (redirectCount < 2 && (Date.now() - startTime) < 6000) {
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200)); // Timing mais humano
        redirectCount = redirects.length;
      }
      
      console.log(`Parando após ${redirectCount} redirects em ${Date.now() - startTime}ms`);
      
    } catch (error) {
      console.log('Navegação interrompida:', error.message);
    }
    
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
      maxRedirectsReached: maxRedirectsReached,
      isLoginPage: finalUrl.includes('login') || finalUrl.includes('signin') || finalUrl.includes('auth'),
      requestCount: requestCount,
      nextIPRotation: 5 - (requestCount % 5),
      proxyStatus: proxyWorking ? 'FUNCIONANDO' : 'DOWN'
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
