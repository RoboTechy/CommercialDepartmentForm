#!/bin/sh
# دیپلوی خودکار PRT: هر بار اجرا شود، چک می‌کند آیا commit جدیدی روی
# branch مشخص‌شده در گیت‌هاب آمده؛ اگر آمده باشد خودش pull می‌کند و
# ایمیج داکر را دوباره می‌سازد و بالا می‌آورد. اگر تغییری نباشد، بی‌صدا
# خارج می‌شود.
#
# استفاده‌ی دستی:
#   ./scripts/auto-deploy.sh
#
# استفاده‌ی خودکار (کرون - مثلاً هر ۵ دقیقه یک‌بار چک کند):
#   */5 * * * * /path/to/CommercialDepartmentForm/scripts/auto-deploy.sh
#
# پیش‌نیاز: کاربری که این اسکریپت را (با کرون) اجرا می‌کند باید بدون sudo
# به داکر دسترسی داشته باشد، وگرنه دستور docker compose با خطای دسترسی
# مواجه می‌شود. یک‌بار این را اجرا کنید (و بعد از سرور خارج و دوباره وارد
# شوید تا اعمال شود):
#   sudo usermod -aG docker $USER

set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")/.." && pwd)
BRANCH="claude/ldap-auth-section-access-pp91cv"
LOG_FILE="$SCRIPT_DIR/auto-deploy.log"
LOCK_FILE="$SCRIPT_DIR/.auto-deploy.lock"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# جلوگیری از اجرای هم‌زمان دو نسخه از این اسکریپت (مثلاً اگر بیلد قبلی هنوز
# در حال اجراست و کرون دوباره صدایش زد)
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

cd "$SCRIPT_DIR"

if ! FETCH_OUTPUT=$(git fetch origin "$BRANCH" 2>&1); then
  log "خطا در git fetch: $FETCH_OUTPUT"
  exit 1
fi

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
  exit 0
fi

log "تغییر جدید پیدا شد ($LOCAL_COMMIT -> $REMOTE_COMMIT). در حال بروزرسانی..."

if ! git pull origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "خطا در git pull - بروزرسانی متوقف شد."
  exit 1
fi

if ! docker compose up -d --build >> "$LOG_FILE" 2>&1; then
  log "خطا در docker compose up --build - لطفاً auto-deploy.log را بررسی کنید."
  exit 1
fi

log "بروزرسانی و rebuild با موفقیت انجام شد."
