# MindCare — Portal Paciente/Psicólogo

Plataforma de acompanhamento psicológico online (paciente ↔ psicólogo) construída em
React + Vite + TypeScript + Tailwind + shadcn/ui, com Supabase como backend
(Postgres + Auth + Realtime + RLS).

> Status: em desenvolvimento. **Ainda não usar em produção real com pacientes**
> sem antes auditar segurança, configurar confirmação de e-mail no Supabase,
> formalizar consentimento LGPD e instituir backup/auditoria de acesso.

---

## Stack

- **React 18** + **Vite 5** + **TypeScript**
- **Tailwind 3** + **shadcn/ui** (Radix)
- **react-router-dom 6**
- **@tanstack/react-query** (cache de queries)
- **sonner** (toasts) — usar `import { toast } from "sonner"` em **todo** o código
- **Supabase JS 2** (auth, postgres, realtime)
- **Vitest** (testes), **Playwright** (e2e)

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="SUA_ANON_KEY_AQUI"
VITE_SUPABASE_PROJECT_ID="seu_project_id"
```

> Se as duas primeiras variáveis estiverem faltando, o app **falha rápido**
> com mensagem em vermelho na tela em vez de uma tela em branco — comportamento
> intencional para acelerar diagnóstico.

---

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:8080
npm run lint
npm run test
npm run build
npm run preview
```

A configuração do Vite usa `host: true`, então o servidor de dev fica acessível
de outros dispositivos da rede local em `http://<seu-ip>:8080`.

---

## Banco de dados

Migrations em `supabase/migrations/`. Aplique-as **na ordem do timestamp** com a
CLI do Supabase ou pelo painel.

A migration mais recente (`20260425000000_security_and_scheduling_hardening.sql`)
faz mudanças críticas:

1. **Cria a view `public.psychologist_directory`** com apenas as colunas que um
   paciente pode ver de um psicólogo (sem e-mail, sem telefone). A policy antiga
   que retornava todas as colunas de `profiles` para qualquer authenticated foi
   removida.
2. **Cria a função `get_user_display_name(uuid)`** com `SECURITY DEFINER`.
   Use-a (`supabase.rpc("get_user_display_name", { target_user_id })`) sempre que
   precisar mostrar o nome de outro usuário no chat ou em listagens. Ela
   retorna `NULL` se o caller não tem direito de ver.
3. **Adiciona `EXCLUDE` constraint em `appointments`** para garantir, no banco,
   que dois pacientes não podem ocupar o mesmo slot do mesmo psicólogo
   simultaneamente. A violação retorna o código Postgres `23P01`, tratado no
   frontend.
4. **Adiciona trigger `validate_appointment`** que rejeita inserções
   (a) em horário passado, (b) fora da `availability_slots` do psicólogo e
   (c) com `start_time >= end_time`.
5. **Restringe o INSERT em `messages`** para só permitir mensagem entre pares
   com vínculo (`psychologist_patients`) ou paciente → psicólogo do diretório
   (primeira mensagem).
6. **Valida formato do CRP** com check constraint `^\d{2}/\d{4,6}$`.
7. **Habilita realtime em `appointments`** para que pacientes vejam slots
   ocupando ao vivo.

---

## Autenticação

### Confirmação de e-mail

Confira no painel Supabase em **Authentication → Providers → Email** se a opção
"Confirm email" está habilitada. Em uma aplicação de saúde mental, **deve estar**.

O `signUp` no `AuthContext` retorna `{ needsEmailConfirmation }`. A `Auth.tsx`
ajusta a mensagem ao usuário conforme esse flag.

### Política de senhas

Definida em `Auth.tsx`: mínimo de 10 caracteres, com pelo menos uma letra e um
número. **A força final ainda é definida pelo Supabase Auth** — configure as
regras lá também.

---

## Agendamento (timezone-safe)

**Nunca use `Date#toISOString()`** para extrair a data de um horário escolhido
pelo usuário. Em UTC-3, qualquer horário >= 21h local vira o dia seguinte em UTC,
o que era a causa principal de "consultas marcadas no dia errado".

Use as helpers em `src/lib/datetime.ts`:

- `toLocalDateString(d)` → `"YYYY-MM-DD"` em horário **local**
- `toLocalTimeString(h, m)` → `"HH:MM:00"`
- `fromLocalDateString("2026-04-25")` → `Date` na meia-noite local
- `startOfWeekMonday(d)`, `addDays(d, n)`, `isPastSlot(d, h)`

A tela `FindPsychologists.tsx` consulta a `availability_slots` do psicólogo e
só mostra como "Livre" os slots que: (a) estão dentro de uma faixa cadastrada,
(b) não conflitam com appointments existentes, (c) não estão no passado.

A tela `PsychologistAvailability.tsx` permite ao psicólogo cadastrar suas faixas
de horário por dia da semana.

---

## Deploy

### Build

```bash
npm run build
```

Os arquivos gerados em `dist/` têm hash no nome (cache busting automático).
Apenas o `index.html` **não** tem hash — por isso ele já vem servido com
`Cache-Control: no-cache` via `<meta>`.

### "Atualizei o deploy mas o celular não vê a versão nova"

Causas comuns:

1. **Cache HTTP do `index.html`** no navegador móvel — o meta `no-cache` que
   adicionamos resolve em quase todos os casos. Se persistir, use aba anônima.
2. **Service Worker antigo** — alguma versão anterior pode ter registrado um
   SW. O bloco de "kill switch" no rodapé do `index.html` desregistra
   qualquer SW remanescente e limpa todos os caches no carregamento. Pode ser
   removido depois que todos os usuários tiverem aberto o app pelo menos uma
   vez após esse deploy.
3. **PWA "Adicionar à tela inicial"** — o ícone instalado guarda snapshot.
   No celular: pressione e segure o ícone, "Remover atalho", abra pelo
   navegador novamente e reinstale.
4. **CDN do Lovable** — TTL na borda. Em geral resolve em poucos minutos.

### Como confirmar **na hora**, no celular, que o deploy chegou

Cada build injeta uma string `__BUILD_VERSION__` (formato `YYYYMMDDHHmm`)
exibida no canto inferior direito do app pelo componente `<AppVersion />`.
Se o número mudou, a versão chegou.

---

## Estrutura de pastas

```
src/
├── App.tsx                       # Roteamento + ErrorBoundary
├── main.tsx                      # entrypoint
├── components/
│   ├── ChatBox.tsx               # chat 1-1 com realtime e dedup
│   ├── ErrorBoundary.tsx
│   ├── AppVersion.tsx
│   └── ui/                       # shadcn/ui (não editar manualmente)
├── contexts/
│   └── AuthContext.tsx
├── integrations/supabase/
│   ├── client.ts                 # cliente com validação de env
│   └── types.ts                  # gerado pelo Supabase
├── lib/
│   ├── datetime.ts               # helpers TZ-safe
│   └── utils.ts                  # cn()
└── pages/
    ├── Auth.tsx
    ├── RoleSelect.tsx
    ├── PsychologistOnboarding.tsx
    ├── PatientOnboarding.tsx
    ├── PsychologistDashboard.tsx
    ├── PsychologistPatients.tsx
    ├── PsychologistAvailability.tsx
    ├── PsychologistChats.tsx
    ├── PsychologistChatConversation.tsx
    ├── PatientDashboard.tsx
    ├── FindPsychologists.tsx
    ├── ChatWithPsychologist.tsx
    └── NotFound.tsx
```

---

## Backlog conhecido

- Notificação push (paciente lembrar consulta) — provavelmente via OneSignal ou
  Web Push API.
- Reminder por e-mail no dia anterior à consulta — Supabase Edge Function.
- Telechamada (vídeo) — integração com Daily.co ou Jitsi.
- Audit log de quem leu prontuário (LGPD).
- Application-level encryption em campos clínicos (medicamentos, queixa).
- Configurar `Confirm email` no Supabase Auth.
- 2FA para psicólogos.
- Termos de uso e Política de Privacidade reais (links no rodapé do `Auth.tsx`).
- Tela de configurações para psicólogo bloquear/desbloquear paciente.
- Permitir paciente cancelar agendamento com antecedência mínima de N horas.
- Dark mode toggle no header.
- Internacionalização real com i18next.
