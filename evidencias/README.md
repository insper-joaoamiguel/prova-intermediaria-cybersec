# Evidências da avaliação

Esta pasta contém arquivos exportados durante as execuções reais no Firefox. A estrutura separa os três sites reais e os testes DuckDuckGo Privacy Test Pages.

```text
evidencias/
  blacklight/
    blacklight-resultados.json
    README.md
  ublock/
    README.md
    ublock-resultados.json
    prints/
  bradesco/
    banco.bradesco.har
    privacy-report-bradesco.json
    prints/
  porsche/
    www.porsche.com.har
    privacy-report-porsche-off.json
    privacy-report-porsche-on.json
    prints/
  shopee/
    shopee.com.br.har
    privacy-report-shopee-off.json
    privacy-report-shopee-on.json
    prints/
  ddg/
    tracker-reporting/
    storage-blocking/
    fingerprinting/
```

Os HARs foram exportados pelo DevTools do Firefox. Os JSONs foram exportados pelo botão “Exportar relatório técnico (JSON)” da extensão.

As subpastas `prints/` contêm os principais prints do painel com o bloqueio desligado e ligado. Os nomes indicam o teste e o estado da execução.

O teste DDG Tracker Reporting possui cinco variantes: `script src`, surrogate, `img src`, `document fragment` e `fetch`. Storage Blocking possui os estados desligado e ligado. Fingerprinting/Canvas possui os estados desligado e ligado.

Os contadores devem ser interpretados junto com o timestamp e a URL do JSON. Sites dinâmicos podem alterar domínios e requisições entre capturas. Não reproduzir valores de cookies ou parâmetros pessoais no relatório; usar apenas nomes de sinais, contagens, hosts e tipos técnicos necessários.

Os resultados do Blacklight estão em `blacklight/`, com os links das inspeções e dos arquivos ZIP gerados pela ferramenta. A pasta `ublock/` contém a interpretação e as três capturas do uBlock Origin Logger.
