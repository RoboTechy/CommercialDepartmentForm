#!/bin/sh
# بکاپ‌گیری ساده از دیتابیس PRT. یک کپی timestamp-دار از data/app.db در
# پوشه‌ی backups می‌سازد و بکاپ‌های قدیمی‌تر از KEEP_DAYS روز را پاک می‌کند.
#
# استفاده‌ی دستی:
#   ./scripts/backup.sh
#
# استفاده‌ی خودکار (کرون - مثلاً هر شب ساعت ۲ بامداد):
#   0 2 * * * /path/to/CommercialDepartmentForm/scripts/backup.sh >> /path/to/CommercialDepartmentForm/backups/backup.log 2>&1

set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DB_FILE="$SCRIPT_DIR/data/app.db"
BACKUP_DIR="$SCRIPT_DIR/backups"
KEEP_DAYS=30

if [ ! -f "$DB_FILE" ]; then
  echo "فایل دیتابیس یافت نشد: $DB_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="$BACKUP_DIR/app-$TIMESTAMP.db"

cp "$DB_FILE" "$DEST"
echo "بکاپ ساخته شد: $DEST"

find "$BACKUP_DIR" -name 'app-*.db' -mtime "+$KEEP_DAYS" -delete
