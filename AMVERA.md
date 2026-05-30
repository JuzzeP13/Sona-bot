# Deploy to Amvera

This project is prepared for Amvera as one Docker application:

- Express serves the API at `/api/*`.
- Express serves the built React app from `/`.
- PostgreSQL must be a separate managed PostgreSQL service in Amvera.

## Files

- `Dockerfile` builds frontend and backend into one runtime container.
- `amvera.yaml` tells Amvera that the app listens on port `3000`.
- `.env.amvera.example` lists the production variables to add in Amvera.

## Amvera setup

1. Create a managed PostgreSQL database in Amvera.
2. Copy the internal read/write host from the database info page. It usually looks like:

   ```text
   amvera-<username>-cnpg-<project_name>-rw
   ```

3. In the application settings, add variables/secrets from `.env.amvera.example`.
4. Set `DATABASE_URL` like this:

   ```text
   postgresql://<db_user>:<db_password>@<internal_postgres_host>:5432/<db_name>?schema=public
   ```

5. Set the public domain in both:

   ```text
   FRONTEND_ORIGIN=https://<your-app-domain>
   CORS_ORIGINS=https://<your-app-domain>
   ```

6. Deploy the repository to Amvera.

The container runs `prisma migrate deploy` before starting the server, so database migrations are applied automatically on deploy.

## First admin

The app does not seed the admin automatically on every start. After the first successful deploy, run this once from the Amvera app console:

```bash
npm run seed
```

The seed uses:

```text
ADMIN_NAME
ADMIN_EMAIL
ADMIN_PASSWORD
```

## Useful checks

- Healthcheck: `https://<your-app-domain>/api/health`
- Login: `https://<your-app-domain>/login`
- Admin dashboard: `https://<your-app-domain>/admin/dashboard`
