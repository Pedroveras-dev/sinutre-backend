-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_health_data" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "target_diet_daily" INTEGER NOT NULL,
    "level_activity" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "health_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_health_data" ("closed_at", "created_at", "id", "is_active", "level_activity", "target_diet_daily", "user_id") SELECT "closed_at", "created_at", "id", "is_active", "level_activity", "target_diet_daily", "user_id" FROM "health_data";
DROP TABLE "health_data";
ALTER TABLE "new_health_data" RENAME TO "health_data";
CREATE INDEX "health_data_user_id_is_active_idx" ON "health_data"("user_id", "is_active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
