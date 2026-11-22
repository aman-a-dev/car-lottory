-- CreateTable
CREATE TABLE "lottery_images" (
    "id" TEXT NOT NULL,
    "lottery_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lottery_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lottery_images_lottery_id_idx" ON "lottery_images"("lottery_id");

-- AddForeignKey
ALTER TABLE "lottery_images" ADD CONSTRAINT "lottery_images_lottery_id_fkey" FOREIGN KEY ("lottery_id") REFERENCES "lotteries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
