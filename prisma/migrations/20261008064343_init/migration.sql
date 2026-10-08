-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cutting_supervisor', 'cutting_verifier', 'sewing_supervisor');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CUTTING_IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED', 'SEWING_IN_PROGRESS');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "recipe_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "std_fabric_yards" DECIMAL(6,2) NOT NULL,
    "wastage_cap" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_components" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "component_name" TEXT NOT NULL,
    "pieces_per_garment" INTEGER NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "recipe_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_orders" (
    "id" SERIAL NOT NULL,
    "order_no" TEXT NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "fabric_roll_id" TEXT NOT NULL,
    "actual_fabric_yds" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CUTTING_IN_PROGRESS',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER,
    "status" "ItemStatus",

    CONSTRAINT "verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "verifier_id" INTEGER NOT NULL,
    "decision" "Decision" NOT NULL,
    "rejection_note" TEXT,
    "wastage_pct" DECIMAL(7,2),
    "variances" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_recipe_code_key" ON "recipes"("recipe_code");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_components_recipe_id_component_name_key" ON "recipe_components"("recipe_id", "component_name");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_orders_order_no_key" ON "cutting_orders"("order_no");

-- CreateIndex
CREATE INDEX "cutting_orders_status_idx" ON "cutting_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_order_id_component_id_key" ON "verification_items"("order_id", "component_id");

-- AddForeignKey
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "recipe_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
