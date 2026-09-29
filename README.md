# Privacy Tracker Inspector

Extensão Firefox para inspeção de sinais de rastreamento, armazenamento e instrumentação usados por uma página. Este repositório contém a entrega final integrada da avaliação intermediária de Cibersegurança.

## Escopo da entrega

A extensão reúne, em uma única implementação:

- manifesto Firefox instalável por `about:debugging`;
- painel por aba com domínios de primeira e terceira parte, tipos de requisição, status e bloqueios;
- observação de cookies recebidos por `Set-Cookie` e mudanças detectadas pela API de cookies;
- distinção entre cookies de sessão e persistentes;
- inspeção de `localStorage`, `sessionStorage` e nomes de bancos IndexedDB por origem/frame;
- detecção de canvas fingerprinting, WebSocket, EventSource, `fetch`, XHR, Beacon e polling persistente;
- identificação de candidatos a bounce tracking e cookie sync em tráfego cross-site;
- identificação de scripts injetados, alterações suspeitas na superfície global e hooks de interação;
- candidatos a vazamento de nomes de campos em requisições de terceira parte, sem armazenar valores sensíveis;
- bloqueio opcional por lista conhecida e lista personalizada de domínios;
- exportação de relatório técnico da aba em JSON;
- pontuação de privacidade de 0 a 100, com critérios, pesos, penalidades e justificativas.

Os sinais de bounce, cookie sync, fingerprinting, hooks e vazamento são apresentados como candidatos observados. A confirmação deve considerar a página de teste, o HAR, o JSON exportado e as ferramentas de referência.

## Instalação temporária no Firefox

1. Abra `about:debugging`.
2. Selecione **Este Firefox**.
3. Clique em **Carregar extensão temporária...**.
4. Selecione o arquivo `manifest.json` deste diretório.
5. Abra uma página de teste e clique no ícone da extensão para consultar o relatório da aba.

Após alterações nos arquivos, use **Recarregar** em `about:debugging` e atualize a página de teste.

## Evidências e relatório

- `docs/ENTREGA-FINAL.md`: relatório técnico completo, metodologia, análises e comparação externa.
- `output/pdf/relatorio-entrega-final.pdf`: versão PDF pronta para envio.
- `evidencias/`: HARs, JSONs, capturas da extensão, resultados do Blacklight e capturas do uBlock Origin Logger.
- `evidencias/blacklight/`: resultados dos três sites analisados no Blacklight.
- `evidencias/ublock/`: interpretação e capturas do Logger para Bradesco, Porsche e Shopee.

As evidências foram coletadas em execuções reais no Firefox. Os valores podem variar em sites dinâmicos; por isso, cada análise preserva a URL, o estado do bloqueio, o horário quando disponível e o artefato correspondente.

## Estrutura principal

- `manifest.json`: permissões e pontos de entrada da extensão.
- `scoring.js`: metodologia reproduzível da pontuação de privacidade.
- `background.js`: coleta por aba, classificação de primeira/terceira parte, cookies e bloqueio.
- `content-script.js`: coleta de armazenamento da página e ponte com o script de instrumentação.
- `page-probes.js`: instrumentação no contexto da página para APIs normalmente usadas por rastreadores.
- `popup.*`: painel de inspeção da aba ativa.
- `tools/generate_report.py`: gerador do relatório PDF.

## Limitações conhecidas

A classificação de terceira parte usa uma heurística local de domínio registrável e não substitui uma Public Suffix List completa. Blacklight e uBlock Origin utilizam perfis, listas, filtros, user-agents e janelas de execução diferentes da extensão; divergências entre contagens são esperadas e estão explicadas no relatório.

## Verificação rápida

O código não depende de processo de build ou bibliotecas externas para funcionar no Firefox. Para uma verificação local, valide os arquivos JavaScript com o runtime Node disponível na máquina e confirme o manifesto como JSON antes de carregar a extensão.
