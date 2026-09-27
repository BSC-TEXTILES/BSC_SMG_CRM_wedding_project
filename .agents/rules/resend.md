# Send Email with Resend Node.js SDK

**Purpose:** Enforce only the **current** and **correct** instructions for sending emails using the [Resend](https://resend.com/) Node.js SDK.
**Scope:** All AI-generated advice or code related to sending email with Resend must follow these guardrails.

---

## 1. Official Resend Node.js Setup

### Prerequisites

- Create an API key and verify your domain at [https://resend.com/domains](https://resend.com/domains).
- Store the API key in an environment variable called `RESEND_API_KEY`.
- Ensure the domain is verified at [https://resend.com/domains](https://resend.com/domains) and added to the `from` address.

```typescript
const resend = new Resend('YOUR_RESEND_API_KEY');
```

### Install the SDK

Use the project's existing package manager:

```bash
npm install resend
# or: yarn add resend / pnpm add resend / bun add resend
```

### Initialize the Client

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
```

### Send an Email

```typescript
const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['delivered@resend.dev'],
  subject: 'Hello World',
  html: '<strong>It works!</strong>',
});

if (error) {
  console.error(error);
  return;
}

console.log(data); // { id: '49a3999c-...' }
```

### Rate Limiting
- Default rate limit: 10 requests per second per team. Exceeding returns `429`.

### Idempotency
- Use `idempotencyKey` to prevent duplicated emails during retries.
- Format: `<event-type>/<entity-id>` (max 256 characters, expires in 24 hours).

```typescript
const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['delivered@resend.dev'],
  subject: 'Hello World',
  html: '<strong>It works!</strong>',
  idempotencyKey: 'unique-id',
});
```

---

## 2. Parameter Reference

### Required Parameters
- `from` (`string`): Sender email address (`"Name <email@domain.com>"`).
- `to` (`string | string[]`): Recipient(s), maximum 50.
- `subject` (`string`): Email subject line.

### Content Parameters (at least one required)
- `html` (`string`): HTML content.
- `text` (`string`): Plain text content.
- `react` (`React.ReactNode`): React Email component (function call format).

### Optional Parameters
- `cc`, `bcc`, `replyTo`, `scheduledAt`, `headers`, `tags`, `attachments`, `template`.

### Response Pattern
- Success: `{ data: { id: string }, error: null }`
- Failure: `{ data: null, error: { message: string, name: string } }`

---

## 3. Strict Guardrails

1. **Always** store the API key in `RESEND_API_KEY`. Never hardcode keys.
2. **Always** import `Resend` directly from package `resend`.
3. **Always** `await resend.emails.send()`.
4. **Always** inspect `{ data, error }` instead of using try/catch for standard API errors.
5. **Always** use camelCase parameter names (`replyTo`, `scheduledAt`, `idempotencyKey`).
6. **Never** use `onboarding@resend.dev` as the `from` address in production.
7. **Never** send `html`, `text`, or `react` alongside `template`.
