# Gestor de Estoque

Protótipo desktop de gestão de estoque feito com Electron, HTML, CSS e JavaScript puro. Os dados são acessados pelo processo principal via Supabase; o renderer não recebe credenciais nem acesso Node.js.

## Requisitos

- Node.js e npm
- Projeto Supabase

## Configuração do Supabase

1. No Supabase, abra **Project Settings → API** e copie a **Project URL** e a chave **anon/public**. Não use a chave `service_role`.
2. Na raiz do projeto, crie `.env` copiando `.env.example` e preencha:

   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua_chave_anon
   ```

3. No painel do Supabase, abra **SQL Editor**, cole o conteúdo de [`database/schema.sql`](./database/schema.sql) e execute. O script cria as tabelas, índices, trigger de estoque, RLS e provisionamento de um tenant para cada usuário Auth existente ou criado depois.
4. Crie os usuários de acesso em **Authentication → Users**. O MVP não inclui cadastro de conta; o trigger associa cada novo usuário a uma empresa própria. Para cadastrar um usuário depois de executar o schema, o vínculo é criado automaticamente.

O arquivo `.env` é ignorado pelo Git; somente `.env.example` deve ser versionado.

## Executar

Na raiz do repositório:

```bash
npm install
npm start
```

Sem `.env` válido, o app ainda abre, mas mostra uma mensagem explicando quais variáveis estão faltando. Após configurar o ambiente e executar o schema, entre com o e-mail e a senha de um usuário do Supabase Auth.

Para testar sem Supabase, use `teste@teste.com` com a senha `teste123`. A conta local permite cadastrar e gerenciar produtos e movimentações, salvando os dados no arquivo `estoque-local.json` da pasta de dados do aplicativo neste computador. Esses dados não são enviados ao Supabase nem compartilhados com outros usuários. Não use o acesso local como autenticação em produção.

## Escopo do MVP

- Login e logout com Supabase Auth.
- Painel com produtos ativos, itens abaixo do estoque mínimo e as últimas dez movimentações.
- Cadastro, edição, busca, filtro e desativação de produtos.
- Registro e consulta de entradas, saídas e ajustes de estoque.
- Isolamento por tenant com políticas RLS; cada usuário provisionado recebe uma empresa própria.

Cadastro de usuários, convite e gestão de equipes, alternância entre empresas, relatórios/exportação, operação offline, sincronização e publicação/atualizações do aplicativo ficam fora deste protótipo.
