# Avaliação intermediária de Cibersegurança

## Privacy Tracker Inspector

**Aluno:** João Pedro Alves Miguel  
**Instituição:** Insper  
**Data:** 29/09/2026

### Objetivo

O Privacy Tracker Inspector é uma extensão Firefox que observa o tráfego e as APIs usadas por uma página, classifica domínios de primeira e terceira parte, registra cookies e armazenamento, indica sinais de fingerprinting, bounce tracking, cookie sync e hijacking, e calcula uma pontuação de privacidade explicável.

Este relatório reúne a implementação, os resultados reais coletados no Firefox e as divergências que precisam ser explicadas na comparação com as ferramentas de referência.

## Status da coleta

Os JSONs e HARs abaixo foram obtidos durante execuções reais no Firefox e foram copiados para `evidencias/`. Os prints enviados durante a validação documentam a interface da extensão nos estados desligado e ligado.

- DDG Privacy Test Pages: Tracker Reporting, Storage Blocking e Fingerprinting/Canvas.
- Sites reais: Bradesco, Porsche Brasil e Shopee Brasil.
- HARs: 3 sites reais e 7 páginas DDG.
- Comparação externa: Blacklight e uBlock Origin Logger coletados para os três sites.

## 1. Matriz de atendimento aos conceitos

| Conceito | Como o plugin atende | Evidência |
| --- | --- | --- |
| Conexões por domínio | `webRequest` por aba, host, tipo, frame e `siteType` | JSON exportado + HAR |
| Cookies 1P/3P | `Set-Cookie`, `cookies.onChanged`, sessão/persistente | Painel + JSON + HAR |
| HTML5 storage | `localStorage`, `sessionStorage`, IndexedDB por frame/origem | Painel + DDG Storage Blocking |
| Canvas fingerprinting | `toDataURL`, `toBlob` e `getImageData` | DDG Canvas + eventos `canvas` |
| Cookie sync | Identificadores em URL cross-site | `syncSignals` + tráfego observado |
| Bounce tracking | Redirect cross-site em navegação principal | `bounceSignals` + HAR quando presente |
| Hijacking/hook | WebSocket, EventSource, Beacon, polling, globals e scripts injetados | Painel + probes |
| JS leaks | Chaves de dados em requisições de terceira parte, sem valores | `leakSignals` sanitizado |
| Pontuação | 7 critérios, pesos explícitos, penalidades e explicação | `privacyScore` por aba |
| Bloqueio | Lista conhecida + lista personalizada | Testes desligado/ligado |

### Arquitetura

`manifest.json -> scoring.js -> background.js -> content-script.js -> page-probes.js -> popup.html/popup.js`.

O background é a fonte de verdade do relatório. A interface apenas apresenta e exporta a coleta da aba ativa. A classificação de site registrável é uma heurística local e não substitui uma Public Suffix List completa; divergências com ferramentas externas devem ser explicadas por essa diferença metodológica.

## 2. Metodologia de pontuação

A pontuação inicia em 100, onde maior é melhor. Cada critério subtrai uma penalidade limitada ao seu peso. A pontuação organiza sinais técnicos, mas não prova intenção do operador do site.

| Critério | Peso máximo | Penalidade da implementação |
| --- | ---: | --- |
| Domínios de terceira parte | 20 | 2 por domínio, limitado ao peso |
| Cookies de terceira parte | 20 | 3 por cookie de sessão e 5 por persistente |
| Storage fora da origem | 15 | 7,5 por origem 3P com dados |
| Fingerprinting e hooks | 15 | Canvas, hooks de interação e alterações de globals/scripts |
| Cookie sync e bounce | 10 | 3 por sinal |
| Hijacking, polling e canais persistentes | 10 | 2 por sinal |
| Vazamento para terceira parte | 10 | 5 por candidato |

Cada JSON contém `score`, `grade`, `penalty` e `criteria`. Cada critério possui `observed`, `weight`, `penalty` e `explanation`, permitindo repetir a conta e justificar a nota.

Canvas, listeners de interação, scripts injetados e globals podem ter uso legítimo. Por isso, o relatório usa a palavra “candidato” e exige triangulação com a página, o HAR e as ferramentas de referência.

## 3. Testes DuckDuckGo Privacy Test Pages

Os testes foram executados com a extensão carregada temporariamente. O estado desligado foi documentado pelos prints e pelos JSONs de Storage Blocking e Canvas; os JSONs de Tracker Reporting enviados correspondem principalmente ao estado ligado. Cada HAR foi exportado pelo DevTools do Firefox.

| Página | Resultado observado | Evidência |
| --- | --- | --- |
| `1major-via-script.html` | 2 domínios, 1 terceiro; desligado: 0 bloqueios; ligado: `doubleclick.net` bloqueado | `ddg/tracker-reporting/01-via-script.har` + JSON |
| `1major-with-surrogate.html` | 1 requisição de script de `doubleclick.net` bloqueada no estado ligado | `ddg/tracker-reporting/02-with-surrogate.har` + JSON |
| `1major-via-img.html` | 1 requisição de imagem de `facebook.com` bloqueada no estado ligado | `ddg/tracker-reporting/03-via-img.har` + JSON |
| `document-fragment.html` | 1 imagem de `facebook.com` bloqueada após criação dinâmica | `ddg/tracker-reporting/04-document-fragment.har` + JSON |
| `1major-via-fetch.html` | 1 `xmlhttprequest` de `facebook.com` bloqueada; probe `fetch` observado | `ddg/tracker-reporting/05-via-fetch.har` + JSON |
| Storage Blocking | 23 mecanismos, com falhas próprias de WebSQL/CookieStore; 3 origens 3P com storage observável após coleta completa | `ddg/storage-blocking/` |
| Fingerprinting/Canvas | 125 eventos `canvas` nos dois estados; 0 bloqueios | `ddg/fingerprinting/` |

### 3.1 Tracker Reporting

Os cinco testes confirmaram vetores distintos: `script src`, surrogate, `img src`, criação dinâmica por `document fragment` e `fetch`. O bloqueio não remove o domínio da lista de observados; ele cancela a requisição e mantém a tentativa como evidência. No teste de `fetch`, o Firefox representa a chamada como `xmlhttprequest`, enquanto o probe da página registra semanticamente `fetch`.

Os JSONs ligados registraram uma requisição bloqueada em cada variação, com pontuação 98/A, sem cookies, storage ou sinais adicionais. Os prints desligados mostraram a mesma tentativa sem bloqueio.

### 3.2 Storage Blocking e Storage Partitioning

A página reportou 23 mecanismos e duas falhas próprias: WebSQL não está disponível e uma leitura de CookieStore retornou nulo em um iframe. Na coleta desligada repetida, a extensão observou 57 cookies, 42 de terceiros e armazenamento em três origens de terceiros. Com o bloqueio ligado, também foram observadas três origens de terceiros, sem requisições bloqueadas; o botão implementado é um bloqueador de rede baseado em domínios, não uma implementação de particionamento do armazenamento do Firefox.

O campo `storagePartitioning` é, portanto, diagnóstico. Ele mostra a origem, o frame e a quantidade de chaves observadas, mas não prova sozinho se uma chave foi compartilhada entre contextos ou particionada pelo navegador.

### 3.3 Fingerprinting e Canvas

Nos dois estados foram registradas 125 chamadas `canvas`. A página apresentou falhas próprias de sanidade de pixels, mas isso não é erro da extensão. O resultado comprova a detecção das APIs Canvas e foi incorporado ao critério de fingerprinting da pontuação.

## 4. Três sites reais

Os três sites abaixo foram preenchidos com os endereços visitados. A validade acadêmica final depende de eles estarem entre os sites sorteados ou divulgados pelo professor.

| Site | URL final | Execução | 1P/3P | Cookies | Storage 3P | Sinais | Score |
| --- | --- | --- | ---: | --- | --- | --- | ---: |
| Bradesco | `https://banco.bradesco/html/classic/index.shtm` | bloqueio desligado | 1/9 | 40/1; 10 sessão, 30 persistentes | 0 | probes 81; sync 1; bounce 1 | 56 D |
| Porsche Brasil | `https://www.porsche.com/brazil/pt/` | desligado / ligado | 6/8 -> 7/6 | 10/0 -> 6/0 | 1 origem 3P | probes 118 -> 115; sync 1; bounce 1 | 54 D -> 58 D |
| Shopee Brasil | `https://shopee.com.br/` | desligado / ligado | 2/6 -> 2/6 | 148/0 -> 181/0 | 0 | Canvas 101; probes 250; sync 1; bounce 1 | 57 D -> 57 D |

### 4.1 Bradesco

O painel observou 10 domínios, 9 de terceira parte e 100 requisições. Foram observados 41 cookies: 40 próprios e 1 de terceiro; entre os próprios, 10 eram de sessão e 30 persistentes. Houve 8 chaves de `localStorage`, nenhuma chave de `sessionStorage` e nenhum banco IndexedDB observável. A extensão registrou 81 probes, 62 hooks de interação, 9 alterações globais, 1 cookie sync e 1 bounce candidate. A pontuação foi 56/D. O HAR correspondente contém 137 entradas.

### 4.2 Porsche Brasil

Com o bloqueio desligado, foram observados 14 domínios, 8 de terceira parte, 100 requisições e pontuação 54/D. Com o bloqueio ligado, o resumo passou a 13 domínios, 6 de terceira parte e 1 requisição bloqueada: o script do `www.googletagmanager.com`. A pontuação foi 58/D. Os dois estados observaram uma origem de armazenamento de terceira parte associada ao Usercentrics, 1 sync candidate, 1 bounce candidate e cerca de 20 sinais de hook/canal. O HAR possui 123 entradas.

### 4.3 Shopee Brasil

No estado desligado, foram observados 8 domínios, 6 de terceira parte, 100 requisições e pontuação 57/D. A coleta registrou 148 cookies próprios, sendo 144 persistentes, 101 chamadas Canvas, 1 sync candidate, 1 bounce candidate e 20 sinais de instrumentação/hijacking. No estado ligado, o resumo registrou 1 bloqueio do Google Tag Manager e a pontuação permaneceu 57/D. Não foram observados cookies ou storage classificados como de terceira parte. O HAR possui 127 entradas.

Os contadores podem variar entre capturas porque a Shopee carrega conteúdo dinamicamente. Em uma captura visual apareceu 7 domínios/5 terceiros/59 pontos, enquanto o JSON correspondente registrou 8/6/57; a divergência deve ser descrita como diferença temporal entre capturas.

## 5. Comparação com Blacklight e uBlock Origin

Blacklight monitora scripts e requisições em um perfil automatizado e procura categorias como cookies de terceira parte, ad trackers, keylogging, session recording e canvas fingerprinting. O uBlock Origin Logger mostra requests e elementos bloqueados ou permitidos e o filtro responsável. O plugin observa o Firefox real da aba e tem outra política de bloqueio; portanto, os números não precisam coincidir.

O Blacklight foi executado para os três sites em localização California, com dispositivo Mobile/iPhone emulado. Os links, horários e arquivos ZIP gerados estão em `evidencias/blacklight/blacklight-resultados.json`. O uBlock foi observado no Firefox com o Logger aberto e suas capturas estão em `evidencias/ublock/prints/`.

| Site | Plugin | Blacklight | uBlock Origin | Estado |
| --- | --- | --- | --- | --- |
| Bradesco | 9 domínios 3P; 41 cookies; score 56/D | 11 ad trackers; 14 cookies 3P; canvas; Facebook/TikTok/X | beacon `omtrdc.net` bloqueado; scriptlet de clipboard; exceção XHR visível | comparar amostra do Logger |
| Porsche | 8 -> 6 domínios 3P; GTM bloqueado; score 54 -> 58/D | 1 ad tracker; 0 cookies 3P; sem canvas | dois XHR `nr-data.net` bloqueados | comparar amostra do Logger |
| Shopee | 6 domínios 3P; GTM bloqueado; 101 Canvas; score 57/D | 0 ad trackers; 0 cookies 3P; canvas via `shopeemobile.com` | XHR `__t_` e relatório CSP bloqueados | comparar amostra do Logger |

As divergências já explicáveis são: o plugin observa a aba real e frames durante a janela de coleta; o HAR registra tráfego bruto; a heurística local de site registrável pode diferir de listas externas; o Blacklight usa outro user-agent/localização; e o uBlock depende das listas e exceções instaladas. As capturas do Logger são amostras do carregamento, não contadores totais, e não permitem concluir que todo domínio de terceiro seja rastreador.

| Comparação | Possível divergência | Como justificar |
| --- | --- | --- |
| Plugin x Blacklight | Perfil, navegação e tempo diferentes | URL, data, cache e evento do HAR |
| Plugin x uBlock | Listas e filtros diferentes | Filtro/lista no logger e URL |
| 1P/3P | Heurística local x Public Suffix List | Host, site registrável e regra |
| Canvas/hooks | Instrumentação cobre chamadas, não intenção | Método, dimensão e script |
| Leak | Chaves são candidatos, não valores | Endpoint, chave e tipo sem dado sensível |

## 6. Inventário de evidências

```text
evidencias/
  bradesco/
    banco.bradesco.har
    privacy-report-bradesco.json
  porsche/
    www.porsche.com.har
    privacy-report-porsche-off.json
    privacy-report-porsche-on.json
  shopee/
    shopee.com.br.har
    privacy-report-shopee-off.json
    privacy-report-shopee-on.json
  ddg/
    tracker-reporting/      5 HARs + JSONs das cinco variantes
    storage-blocking/       HAR + JSON desligado/ligado
    fingerprinting/         HAR + JSON desligado/ligado
```

Os HARs foram exportados pelo Firefox e mantidos sem alteração de conteúdo. Os JSONs da extensão preservam contagens e nomes de sinais, sem reproduzir valores de cookies ou dados pessoais.

## 7. Checklist final

- [x] Histórico Git com três commits incrementais.
- [x] `manifest.json` e instalação temporária testados no Firefox.
- [x] Relatório DDG com prints, JSONs, HARs e divergências técnicas.
- [x] Três HARs reais, cinco JSONs reais e prints da extensão.
- [x] Score dos três sites com pesos e justificativas.
- [x] Pasta `evidencias/` organizada por site e teste.
- [x] Resultados e links de Blacklight para os três sites, em `evidencias/blacklight/`.
- [x] Capturas do uBlock Origin Logger para os três sites, em `evidencias/ublock/prints/`.

## Conclusão

A extensão atende aos requisitos técnicos de detecção, apresentação e pontuação. Os testes DDG demonstram os vetores pedidos, e Bradesco, Porsche e Shopee fornecem três execuções reais com JSON, HAR, Blacklight e uBlock Origin Logger. A comparação externa foi feita por evidências observáveis, preservando as diferenças de metodologia e evitando igualar contagens produzidas por ferramentas diferentes.

Referências: `https://privacy-test-pages.site/`, `https://github.com/duckduckgo/privacy-test-pages`, `https://themarkup.org/blacklight` e `https://github.com/gorhill/uBlock/wiki/The-logger`.
