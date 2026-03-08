# Clonar el repositorio
git clone https://github.com/fazt/expense-tracker-ocr.git
cd expense-tracker-ocr

# Instalar dependencias
pnpm install # npm install -g pnpm

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Variables de Entorno
DATABASE_URL="postgresql://usuario:password@localhost:5432/expense_tracker"
OPENAI_API_KEY="tu-api-key"
CLOUDINARY_CLOUD_NAME="tu-cloud-name"
CLOUDINARY_API_KEY="tu-api-key"
CLOUDINARY_API_SECRET="tu-api-secret"

# Bases de Datos
# Sincronizar schema con la base de datos
npx prisma db push

# Ejecutar seed (categorias iniciales)
npx prisma db seed

# Desrrollo
pnpm dev

