-- CreateTable
CREATE TABLE `inventory_items` (
    `id` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `onHand` INTEGER NOT NULL,
    `reserved` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_items_variantId_key`(`variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `onHandDelta` INTEGER NOT NULL DEFAULT 0,
    `reservedDelta` INTEGER NOT NULL DEFAULT 0,
    `reason` VARCHAR(100) NOT NULL,
    `orderId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_variantId_createdAt_idx`(`variantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `slot_capacities` (
    `id` CHAR(36) NOT NULL,
    `deliveryDate` DATE NOT NULL,
    `slot` VARCHAR(20) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `booked` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `slot_capacities_deliveryDate_slot_key`(`deliveryDate`, `slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservations` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `status` ENUM('RESERVED', 'CONFIRMED', 'RELEASED') NOT NULL,
    `deliveryDate` DATE NOT NULL,
    `slot` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reservations_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservation_items` (
    `id` CHAR(36) NOT NULL,
    `reservationId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `tracked` BOOLEAN NOT NULL,

    INDEX `reservation_items_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` CHAR(36) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `routingKey` VARCHAR(80) NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,

    INDEX `outbox_events_publishedAt_createdAt_idx`(`publishedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `processed_events` (
    `eventId` CHAR(36) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reservation_items` ADD CONSTRAINT `reservation_items_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `reservations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
