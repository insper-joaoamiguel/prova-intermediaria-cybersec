# Privacy Tracker Inspector

Extensão Firefox para inspeção de sinais de rastreamento e armazenamento usados por uma página. O projeto está sendo desenvolvido em entregas incrementais para a avaliação intermediária de Cibersegurança.

## Entrega 1 — base executável

Esta entrega contém a base funcional da extensão:

- manifesto Firefox instalável por `about:debugging`;
- painel por aba com domínios de primeira e terceira parte;
- contagem de requisições e recursos bloqueados;
- observação de cookies recebidos por `Set-Cookie` e mudanças detectadas pela API de cookies;
- distinção inicial entre cookies de sessão e persistentes;
- inspeção de `localStorage`, `sessionStorage` e nomes de bancos IndexedDB;
- detecção inicial de canvas fingerprinting, WebSocket, EventSource, `fetch` e XHR;
- bloqueio opcional de domínios reconhecidos como rastreadores.

O bloqueio começa desligado para que a coleta possa ser comparada com o comportamento original da página. Ele pode ser ativado pelo painel da extensão.

## Instalação temporária no Firefox

1. Abra `about:debugging`.
2. Selecione **Este Firefox**.
3. Clique em **Carregar extensão temporária...**.
4. Selecione o arquivo `manifest.json` deste diretório.
5. Abra uma página de teste e clique no ícone da extensão para ver o relatório da aba.

Após alterações nos arquivos, use **Recarregar** em `about:debugging` e atualize a página de teste.

## Estrutura

- `manifest.json`: permissões e pontos de entrada da extensão.
- `background.js`: coleta por aba, classificação de primeira/terceira parte, cookies e bloqueio.
- `content-script.js`: coleta de armazenamento da página e ponte com o script de instrumentação.
- `page-probes.js`: instrumentação no contexto da página para APIs normalmente usadas por rastreadores.
- `popup.*`: painel de inspeção da aba ativa.

## Limitações conhecidas desta entrega

A classificação de terceira parte usa uma heurística local de domínio registrável e não substitui uma lista pública completa de sufixos. A reconciliação com Blacklight/uBlock, análise de bounce tracking, exportação de HAR, metodologia de pontuação e relatório PDF serão adicionadas nas próximas entregas, junto com as evidências dos três sites reais.

## Verificação rápida

O código não depende de um processo de build ou de bibliotecas externas. Para uma verificação sintática local, valide os arquivos JavaScript com o runtime Node disponível na máquina e confirme o manifesto como JSON antes de carregar a extensão no Firefox.
