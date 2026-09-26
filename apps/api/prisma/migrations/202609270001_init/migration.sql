-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Zone" AS ENUM ('BANANI', 'MOHAKHALI', 'GULSHAN_1', 'GULSHAN_2', 'MIRPUR_10', 'UTTARA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "license_plate" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "driver_status" "DriverStatus" NOT NULL DEFAULT 'OFFLINE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "corridor_id" TEXT NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "occupied_seats" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL,
    "passenger_id" UUID NOT NULL,
    "pickup_zone" "Zone" NOT NULL,
    "dropoff_zone" "Zone" NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "seats_requested" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_memberships" (
    "id" UUID NOT NULL,
    "pool_id" UUID NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "seats_allocated" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fares" (
    "id" UUID NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "base_fare_poysha" INTEGER NOT NULL,
    "distance_fare_poysha" INTEGER NOT NULL,
    "discount_poysha" INTEGER NOT NULL,
    "total_fare_poysha" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',

    CONSTRAINT "fares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_status_history" (
    "id" UUID NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "from_status" "RideStatus",
    "to_status" "RideStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_id_key" ON "vehicles"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_license_plate_key" ON "vehicles"("license_plate");

-- CreateIndex
CREATE INDEX "pools_candidate_idx" ON "pools"("status", "corridor_id", "created_at");

-- CreateIndex
CREATE INDEX "ride_passenger_history_idx" ON "ride_requests"("passenger_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pool_memberships_ride_request_id_key" ON "pool_memberships"("ride_request_id");

-- CreateIndex
CREATE INDEX "pool_memberships_manifest_idx" ON "pool_memberships"("pool_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "fares_ride_request_id_key" ON "fares"("ride_request_id");

-- CreateIndex
CREATE INDEX "ride_status_history_idx" ON "ride_status_history"("ride_request_id", "created_at");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fares" ADD CONSTRAINT "fares_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database constraints that Prisma schema cannot represent directly.
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_capacity_check" CHECK ("capacity" BETWEEN 1 AND 3);
ALTER TABLE "pools" ADD CONSTRAINT "pools_occupied_seats_check" CHECK ("occupied_seats" >= 0);
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_route_check" CHECK ("pickup_zone" <> "dropoff_zone");
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_seats_check" CHECK ("seats_requested" BETWEEN 1 AND 3);
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_seats_check" CHECK ("seats_allocated" BETWEEN 1 AND 3);
ALTER TABLE "fares" ADD CONSTRAINT "fares_amounts_check" CHECK (
  "base_fare_poysha" >= 0 AND "distance_fare_poysha" >= 0 AND "discount_poysha" >= 0
  AND "total_fare_poysha" = "base_fare_poysha" + "distance_fare_poysha" - "discount_poysha"
  AND "total_fare_poysha" >= 0
);

CREATE UNIQUE INDEX "pools_one_active_per_vehicle_idx" ON "pools"("vehicle_id")
WHERE "status" IN ('OPEN', 'FULL', 'IN_PROGRESS');

-- Capacity is a physical vehicle attribute. Keeping it immutable makes a pool-row
-- lock sufficient when checking and updating that pool's occupied seat counter.
CREATE FUNCTION prevent_vehicle_capacity_change() RETURNS trigger AS $$
BEGIN
  IF NEW.capacity <> OLD.capacity THEN
    RAISE EXCEPTION 'Vehicle capacity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER vehicles_capacity_immutable BEFORE UPDATE OF capacity ON "vehicles"
FOR EACH ROW EXECUTE FUNCTION prevent_vehicle_capacity_change();
