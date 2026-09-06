# PesquisaAí — PRD

## Problema Original
MVP funcional e responsivo da plataforma PesquisaAí (Belo Jardim - PE). Plataforma simples para encontrar em quais lojas comprar um produto. Fluxo: Pesquisou → Achou → Contatou/Localizou. Slogan: "Pesquisou. Achou. Acabou." Não é marketplace/e-commerce/rede social.

## Arquitetura
- Backend: FastAPI + MongoDB (motor). Rotas com prefixo /api.
- Frontend: React + Tailwind + Shadcn. Rotas: / , /buscar?q= , /loja/:id , /admin.
- Auth: JWT (bearer token em localStorage `pa_token`), admin único seedado do .env.
- Busca: fuzzy server-side em Python (normalização de acentos, sinônimos, stopwords, difflib).
- Dados de loja embutem lista de produtos.

## Personas
- Comprador (mobile): pesquisa produto e contata loja.
- Administrador (Lucas): gerencia lojas/produtos sem editar código.

## Requisitos Core (estáticos)
- Busca inteligente por produto retornando lojas.
- Página de loja com contatos (WhatsApp c/ mensagem automática, Instagram, Google Maps).
- Selo Parceiro (isPartner).
- Painel admin CRUD protegido por login.
- Mobile-first, laranja #FF5A00 sobre branco, sem fotos de produto.

## Implementado (2026-06)
- Homepage minimalista com busca central + lupa laranja.
- Resultados de busca com cards (nome, categoria, chips de produtos, botões de contato).
- Página individual da loja com produtos e informações.
- WhatsApp com mensagem automática codificada incluindo o termo pesquisado.
- Google Maps via maps_url ou endereço; Instagram/Facebook/TikTok condicionais.
- Painel admin: login JWT + criar/editar/excluir loja, definir parceira, editar produtos.
- 4 lojas seedadas (REKILDER MODAS, ATM MAGAZINE, GALLEGA MODAS, ESCANDAL) com campos de contato vazios (não inventados).
- Testado: 15/15 backend + fluxos frontend OK.

## Backlog (P1/P2)
- P1: Migrar on_event para lifespan; PUT admin com $set parcial.
- P2: Rate-limit/lockout no login; ordenar/filtrar lojas no admin; sinônimos de busca ampliados.
