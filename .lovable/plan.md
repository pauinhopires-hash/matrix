## Objetivo

Deixar o app pronto para uso hoje. Nada novo será criado. Apenas: depurar, validar e corrigir o que já existe.

## Escopo (o que vai ser feito)

### 1. Saúde do backend
- Rodar o linter do banco e revisar avisos relevantes (RLS, policies, grants).
- Conferir as policies das tabelas principais: `profiles`, `user_roles`, `setores`, `produtos`, `categorias`, `subcategorias`, `locais`, `sublocais`, `saldos`, `movimentos`, `requisicoes`, `checklist_itens`, `checklist_registros`, `activity_log`.
- Verificar se `setores` libera leitura para anônimo (necessário no `/signup`).
- Conferir grants em todas as tabelas públicas.
- Confirmar buckets `estoque-fotos` (público, ok) e `checklist-fotos` (privado, policies de upload/leitura).

### 2. Fluxos de autenticação
Teste no preview com os 3 admins já criados:
- Login → dashboard
- Logout
- Esqueci senha → email → reset-password
- Signup novo usuário → aparece em `/admin/usuarios` como pending → aprovação → login funciona
- Bloqueio: usuário pending/rejected não consegue logar

### 3. Fluxos principais do app (smoke test via browser)
- Dashboard carrega sem erro
- Checklist: abrir, marcar item, anexar foto, salvar (abertura/meio/fechamento)
- Estoque: listar produtos, categorias, locais/sublocais
- Movimentos: entrada, retirada, transferência, porcionamento, ajuste — conferir que `saldos` é atualizado corretamente pelo trigger
- Requisições: criar, aprovar, atender
- Importar planilha de estoque
- Relatório de estoque carrega
- Admin: aprovar usuário, mudar papel, gerenciar checklists
- Perfil: editar dados próprios (sem conseguir mudar status/email/id)
- Activity log: ações são registradas

### 4. Erros em runtime
- Coletar logs do dev-server e do worker publicado.
- Coletar console e network do preview durante os testes.
- Para cada erro encontrado: diagnóstico + correção mínima (sem refator, sem feature nova).

### 5. SEO mínimo do app publicado
- Conferir título, meta description e favicon na rota pública (`/login`).

## O que NÃO vai ser feito

- Nenhuma tabela, coluna, rota, tela ou componente novo.
- Nenhuma mudança de design.
- Nenhuma integração nova (pagamento, email customizado, etc).
- Refatorações que não sejam necessárias para destravar um bug.

## Entregáveis

- Lista do que foi testado e passou.
- Lista do que estava quebrado, com a correção aplicada.
- Lista do que continua com limitação conhecida (se houver), para você decidir depois.

## Como vamos testar juntos

Eu rodo a auditoria de backend e os smoke tests via browser automation. Quando precisar de uma ação que envolva dados reais sensíveis (ex: aprovar/recusar um usuário real, apagar movimento), eu paro e te pergunto antes.

## Perguntas antes de começar

1. Posso usar o admin `pauinhopires@gmail.com` para os testes no preview? (uso a sessão dele para clicar pelo app)
2. Posso criar 1 usuário de teste fake via signup só para validar o fluxo de aprovação, e depois deixá-lo como `rejected` ou apagá-lo?
3. Posso lançar movimentos de teste em estoque (entrada/retirada de 1 unidade) e depois revertê-los, ou prefere que eu só leia/valide sem escrever em produção?
