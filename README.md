RADIO POP GOSPEL — PLAYER E PLAYLISTAS ATUALIZADOS

Esta versão mantém o site independente da Web Rádio Vem Comigo Deus e conserva o acesso ao painel em /admin.

O que foi atualizado:
- Identidade visual em azul, roxo e branco, sem rosa pink.
- Layout responsivo para celular e computador.
- Player com reproduzir/pausar, faixa anterior/próxima, barra de progresso e volume.
- Lista de músicas e filtro por playlist carregados do painel.
- A playlist escolhida no painel passa a ser a seleção inicial do site.
- Playlist vazia mostra aviso próprio, em vez de misturar músicas de outras listas.
- Mensagens de carregamento e erro no player.
- Atualização dos dados públicos sem cache do navegador.

Como os dados se conectam:
- O site consulta GET /api/public para receber músicas, playlists e a playlist selecionada.
- O áudio é reproduzido por GET /api/audio/:id.
- As músicas e playlists continuam sendo gerenciadas no painel /admin ou pela integração autorizada do painel central.

Publicação:
1. Extraia o ZIP.
2. Envie os arquivos mantendo a pasta Radio-Pop-Gospel-main como raiz do repositório (ou envie o conteúdo dela para a raiz, conforme a estrutura atual do seu GitHub).
3. Faça commit/push no GitHub e aguarde o Render concluir o deploy.
4. Teste o site, abra o painel, envie um MP3, coloque-o em uma playlist e selecione essa playlist para o player público.

Importante:
Esta atualização melhora o player de músicas sob demanda e a integração com as playlists. Ela não configura, por si só, uma transmissão contínua por encoder/Icecast. O status do player só mostra NO AR quando a configuração live do servidor estiver marcada como verdadeira.

Não altere nem apague a pasta de dados persistentes do Render: é nela que ficam a biblioteca e os arquivos enviados, conforme DATA_DIR.


OBSERVAÇÃO SOBRE O PLANO SEM DISCO PAGO
Esta configuração usa o plano Free do Render e não cria disco persistente. A transmissão ao vivo recebida do painel do PC funciona sem armazenar o áudio no servidor. Os MP3 enviados pelo painel web e o banco local ficam no armazenamento temporário do serviço e podem desaparecer após reinício, novo deploy ou manutenção. Para manter uma biblioteca de MP3 enviada pelo site de forma permanente será necessário um armazenamento persistente separado.
