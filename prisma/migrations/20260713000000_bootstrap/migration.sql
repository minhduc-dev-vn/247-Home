-- Slice 1 technical marker only. No business tables are introduced by this migration.
CREATE TABLE "bootstrap_markers" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bootstrap_markers_pkey" PRIMARY KEY ("id")
);
