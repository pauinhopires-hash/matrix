## Objetivo
Em **Fazer pedido** (`/compras/pedido`), adicionar um seletor **SETOR / PERFIL** (igual ao do seu outro app de compras — dropdown com "Todos os setores" como opção padrão) para filtrar os produtos por papel operacional (ex.: Frente de Caixa, Líder Cozinha, Master).

## Decisões assumidas (você pulou as perguntas)
- **Vínculo 1:N**: cada produto pode ter um papel responsável → coluna `produtos.role_id` apontando para `checklist_roles` (mesmo padrão já em `checklist_itens.role_id`).
- **Gestão dos papéis**: reusa a tela já existente `/admin/papeis-operacionais` (sem cadastro novo).
- **Default do filtro**: "Todos os setores" — não esconde nada por padrão; admin continua vendo tudo.
- **Auto-seleção opcional**: se o usuário logado pertence a apenas 1 papel (via `checklist_role_users`), o seletor inicia já filtrado nele; senão fica em "Todos".

## UI (igual ao print que você mandou)
Acima dos chips de grupos existentes:

```text
SETOR / PERFIL (<NOME DO USUÁRIO/CARGO>)
[ Todos os setores ▾ ]
```

- Label pequeno em verde uppercase (`text-primary`) — mesmo tom do seu print.
- `<select>` largo, fundo `bg-card`, borda `border`, mesmo styling dos demais selects do app.
- Opções: `Todos os setores` + cada papel ativo de `checklist_roles` + (se houver produtos sem papel) `Sem papel definido`.

## Mudanças

### 1. Migration
- `alter table public.produtos add column role_id uuid references public.checklist_roles(id) on delete set null;`
- `create index produtos_role_id_idx on public.produtos(role_id);`
- RLS atual de `produtos` já cobre a coluna; sem alteração de policies.

### 2. `src/routes/_authenticated/compras.pedido.tsx`
- Carregar `checklist_roles` ativos junto de produtos/saldos.
- Carregar `checklist_role_users` do usuário logado para detectar auto-seleção.
- Estado `papelFiltro: string` (`""` = todos, `"none"` = sem papel, ou `role_id`).
- `<select>` no topo (acima dos chips de grupo).
- Combina com `grupoFiltro` e `busca` no `useMemo` de `produtosFiltrados`.
- Tipo local `Produto` ganha `role_id: string | null`.
- `select("id, nome, unidade, grupo, subgrupo, role_id")`.

### 3. `src/routes/_authenticated/estoque.produtos.tsx`
- Adicionar `<Select>` "Papel responsável" no formulário de produto (opções: papéis ativos + "Sem papel"). Salva em `produtos.role_id`.

## Detalhes técnicos
- Mantém `supabase as any` (padrão atual do arquivo) até types serem regenerados pós-migration.
- Nenhuma alteração em `compras.lista`, `compras.historico`, `compras.index`, dashboard, navegação, checklists, estoque demais telas, admin/usuarios, login.
- `types.ts` é regenerado automaticamente após a migration ser aprovada.

## Arquivos
- `supabase/migrations/<novo>.sql` — coluna `role_id` em `produtos`.
- `src/routes/_authenticated/compras.pedido.tsx` — seletor SETOR/PERFIL + filtro.
- `src/routes/_authenticated/estoque.produtos.tsx` — campo de papel no cadastro.
- `src/integrations/supabase/types.ts` — regenerado.

## Fora de escopo
- Não criar nova tabela de papéis (reusa `checklist_roles`).
- Não tornar papel obrigatório no produto.
- Não alterar RLS, navegação, dashboard, nem demais telas.
