# Deploy — Shark Money (Vercel + Neon)

Guía para desplegar la app gratis usando **Vercel** (frontend + server actions) y **Neon** (PostgreSQL).

---

## 1. Base de datos en Neon

1. Crea una cuenta en [https://neon.tech](https://neon.tech)
2. Crea un proyecto PostgreSQL nuevo
3. En el dashboard de Neon, copia dos URLs:
   - **Pooled connection** → `DATABASE_URL` (incluye pooling para serverless)
   - **Direct connection** → `DIRECT_URL` (para migraciones)

Añade a la URL pooled el límite de conexiones:

```
postgresql://USER:PASSWORD@HOST/DB?sslmode=require&connection_limit=1
```

Ejemplo:

```
DATABASE_URL="postgresql://neondb_owner:xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&connection_limit=1"
DIRECT_URL="postgresql://neondb_owner:xxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

---

## 2. Proyecto en Vercel

1. Sube el repo a GitHub (si aún no está)
2. Importa el proyecto en [https://vercel.com](https://vercel.com)
3. Framework preset: **Next.js**
4. Root directory: raíz del repo

---

## 3. Variables de entorno en Vercel

En **Project → Settings → Environment Variables**, configura:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL pooled de Neon con `connection_limit=1` |
| `DIRECT_URL` | URL directa de Neon |
| `ADMIN_USERNAME` | Usuario admin (solo tú) |
| `ADMIN_PASSWORD` | Contraseña admin fuerte |
| `JWT_SECRET` | Secreto largo aleatorio (≥ 32 caracteres) |

Aplícalas a **Production**, **Preview** y **Development**.

Referencia local: copia `.env.example` a `.env` y rellena los mismos valores.

---

## 4. Aplicar schema y seed

### Schema inicial (solo la primera vez, base vacía)

`db:push` sirve **únicamente** para crear el schema inicial en una base vacía (tu Neon recién creado, demo local, etc.).

Con las URLs de Neon en tu `.env` local:

```bash
npm run db:push
npm run db:seed
```

Esto crea tablas, categorías del sistema y `UserSettings` default (`America/Bogota`, `COP`).

### Cambios de schema después de tener datos reales

Cuando la base ya tiene datos de producción, **no repitas `db:push`**. Ese comando compara el schema contra la DB y puede aplicar cambios destructivos sin historial de migraciones.

Flujo correcto a partir de ahí:

```bash
# 1. En desarrollo: genera la migración SQL versionada
npx prisma migrate dev --name describe_el_cambio

# 2. En producción (Vercel/Neon): aplica migraciones pendientes
npx prisma migrate deploy
```

Usa `DIRECT_URL` (conexión directa) para `migrate dev` y `migrate deploy` si la URL pooled falla o hace timeout.

### Seed idempotente

`npm run db:seed` es **seguro de ejecutar más de una vez**:

| Dato | Comportamiento |
|---|---|
| **Categorías del sistema** | `upsert` por `(name, type)` — no duplica filas; un segundo run no cambia las existentes (`update: {}`) |
| **UserSettings** | Solo crea el registro si aún no existe (`findFirst` → `create`) — no crea un segundo singleton |

Puedes correr `db:seed` de nuevo tras un deploy o si faltan categorías, sin riesgo de duplicados.

### En Vercel (build)

El script `build` ejecuta `prisma generate && next build`.  
**No** incluye `db:push` automático en producción. Aplica schema y seed manualmente desde tu máquina (primera vez) o `migrate deploy` (cambios posteriores).

```bash
# Solo schema inicial en base vacía:
npm run db:push
npm run db:seed

# Cambios posteriores con datos reales:
npx prisma migrate deploy
# seed solo si necesitas re-poblar categorías/settings:
npm run db:seed
```

Para comandos Prisma contra Neon, usa `DIRECT_URL` si `DATABASE_URL` pooled da timeout.

---

## 5. Verificación post-deploy

1. Abre la URL de Vercel → redirige a `/login`
2. Inicia sesión con `ADMIN_USERNAME` / `ADMIN_PASSWORD`
3. Ve a **Configuración** → confirma timezone y moneda
4. Crea una cuenta en **Cuentas**
5. Registra un gasto desde el **FAB** del dashboard o en **Transacciones**
6. Revisa que el balance se actualice

---

## 6. Comandos útiles

```bash
# Desarrollo local
npm run dev

# Verificación antes de deploy
npm test
npm run typecheck
npm run build

# Base de datos
npm run db:push          # Solo schema inicial (base vacía)
npm run db:seed          # Idempotente — categorías upsert + settings si falta
npm run db:generate
npx prisma migrate dev   # Cambios de schema con datos (desarrollo)
npx prisma migrate deploy # Cambios de schema en producción
```

---

## 7. Notas serverless

- Prisma usa `@prisma/adapter-pg` con pool `max: 1` en `src/lib/prisma.ts`
- No uses `connection_limit` mayor a 1 en el free tier de Neon + Vercel serverless
- Los KPIs del dashboard se calculan al vuelo; no hay jobs ni cache de scores

---

## 8. Troubleshooting

| Problema | Solución |
|---|---|
| Too many connections | Verifica `connection_limit=1` en `DATABASE_URL` |
| Login falla | Revisa `ADMIN_*` y `JWT_SECRET` en Vercel |
| "No hay configuración inicial" | Ejecuta `npm run db:seed` contra Neon |
| `db push` timeout | Usa `DIRECT_URL` en `.env` / `prisma.config.ts` |
| Cambié el schema con datos en Neon | Usa `migrate dev` + `migrate deploy`, no `db:push` |
