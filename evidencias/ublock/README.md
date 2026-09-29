# uBlock Origin Logger

Esta pasta está preparada para as três capturas do Logger que faltam na comparação externa:

```text
evidencias/ublock/prints/
  bradesco.png
  porsche.png
  shopee.png
```

Os resultados interpretados estão em `ublock-resultados.json`. As linhas vermelhas são requisições bloqueadas; linhas sem destaque representam requisições permitidas; linhas amarelas/verdes indicam modificações ou exceções. As imagens são amostras visuais do carregamento e não devem ser tratadas como contagem total da sessão.

## Procedimento no Firefox

1. Abra o site no mesmo perfil em que a extensão foi testada.
2. Deixe o uBlock Origin ligado e o bloqueio da extensão desligado, para não misturar os efeitos dos dois bloqueadores.
3. Abra o ícone do uBlock Origin e escolha o ícone de lista para abrir o **Logger**.
4. Limpe o logger e recarregue a página; o Logger é orientado a requisições futuras.
5. Aguarde os requests iniciais terminarem. A captura deve mostrar o domínio, o tipo da requisição, o estado permitido/bloqueado e, quando disponível, a lista/filtro responsável.
6. Salve uma captura para Bradesco, Porsche e Shopee com os nomes acima.

Não faça login, não preencha agência, conta, cartão ou qualquer dado pessoal. Para o relatório, registre somente contagens, hosts, tipos e filtros; o objetivo é comparar o comportamento do bloqueador, não expor conteúdo de sessão.

As três imagens já foram incorporadas ao relatório e ao PDF como evidências visuais.
