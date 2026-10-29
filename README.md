# Texawave_Erp_Production

Texawave ERP New Production level changes

# Start Postgres + Redis

docker compose up -d postgres redis

# Apply the committed migrations (incl. the new audit-column one)

pnpm --filter database exec prisma migrate deploy

pnpm --filter database generate

# Seed the same data you have — org, 3 teams, permission catalog, Super Admin login

pnpm --filter database seed

# Open the prisma studio

pnpm --filter database exec prisma studio

API run command
pnpm --filter api start:dev

UI Run Command
npm run dev
