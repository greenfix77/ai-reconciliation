# سامانه مغایرت‌یابی هوشمند

**AI-Powered Reconciliation Platform — Persian-first, RTL-native**

پلتفرم واقعی و امنِ مغایرت‌یابی حساب‌ها برای محیط فارسی‌زبان: بارگذاری فایل‌های بانکی/دفتری، تطبیق هوشمند رکوردها، گزارش‌گیری و گفتگوی هوش مصنوعی — با پشتیبانی کامل RTL/LTR و دوزبانه (فارسی/انگلیسی).

> 🔒 این ریپوزیتوری **خصوصی** است و شامل دیتابیس عملیاتی (`db/custom.db`) است. آن را عمومی نکنید.

---

## ✨ امکانات

- **مدیریت پروژه‌های مغایرت‌یابی** — ساخت پروژه، تعریف فایل‌های طرف اول و دوم (CSV/Excel/PDF)
- **موتور تطبیق** — تطبیق خودکار بر اساس قواعد قابل‌تنظیم (فیلد کلید، تلورانس مبلغ/تاریخ، نگاشت ستون‌ها)
- **هوش مصنوعی** — تحلیل مغایرت‌ها و چت هوشمند مبتنی بر `z-ai-web-dev-sdk` (کلیدهای API به‌صورت رمزنگاری‌شده AES-256-GCM در دیتابیس ذخیره می‌شوند)
- **گزارش‌ها** — خلاصه وضعیت، تفکیک تطبیق‌ها، خروجی و بررسی جزئیات هر رکورد
- **پنل مدیریت** — مدیریت کاربران، تنظیمات امنیتی، سقف پروژه/مصرف AI
- **امنیت** — bcrypt (cost 12)، JWT در کوکی httpOnly+sameSite=strict، هدر CSRF، قفل حساب پس از تلاش‌های ناموفق، CSP و هدرهای امنیتی
- **دوزبانه و RTL-native** — فارسی/انگلیسی با چیدمان خودکار RTL/LTR و جداسازی صحیح متن‌های دوجهته (`bdi`)

## 🏗️ پشته فناوری

| لایه | فناوری |
|---|---|
| فریم‌ورک | Next.js 16 (App Router) + TypeScript 5 + React 19 |
| رابط کاربری | Tailwind CSS 4 + shadcn/ui + Lucide + sonner |
| دیتابیس | Prisma ORM + SQLite (`db/custom.db`) |
| احراز هویت | jose (JWT HS256) + bcryptjs |
| هوش مصنوعی | z-ai-web-dev-sdk (سمت سرور) |
| ران‌تایم | Bun (توصیه‌شده) یا Node.js 20+ |

## 🚀 استقرار روی سرور جدید (Deployment)

### پیش‌نیازها

- **Bun** ≥ 1.1 (یا Node.js ≥ 20 به‌همراه npm/pnpm — اسکریپت‌ها برای Bun نوشته شده‌اند)
- لینوکس/مک (اسکریپت build از `cp` استفاده می‌کند)

### مراحل

```bash
# ۱) کلون ریپوی خصوصی
git clone https://github.com/<YOUR_USER>/ai-reconciliation.git
cd ai-reconciliation

# ۲) نصب وابستگی‌ها
bun install

# ۳) ساخت Prisma Client
bunx prisma generate

# ۴) ساخت فایل محیطی از روی نمونه
cp .env.example .env
#    DATABASE_URL پیش‌فرض (file:./db/custom.db) معمولاً کافی است.

# ۵) اجرا — حالت توسعه
bun run dev                      # http://localhost:3000

#    — یا — حالت پروداکشن (standalone)
bun run build
bun run start                    # NODE_ENV=production روی پورت 3000
```

> **نکته مهم:** فایل `db/custom.db` همراه با ریپو منتقل می‌شود؛ بنابراین **بدون هیچ مهاجرتی**، حساب مدیر و همه پروژه‌ها/تنظیمات موجود، عیناً در سرور جدید قابل استفاده‌اند. `bun run db:push` را فقط در صورت تغییر `prisma/schema.prisma` اجرا کنید (⚠️ این دستور `--accept-data-loss` دارد).

### پروکسی معکوس (Reverse Proxy)

اپلیکیشن روی پورت `3000` گوش می‌دهد. برای انتقال از دامنه واقعی با TLS، نمونه Caddy:

```caddyfile
your-domain.ir {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

(فایل `Caddyfile` موجود در ریپو مخصوص گیت‌وی همین محیط سندباکس است و صرفاً به‌عنوان نمونه نگه داشته شده است.)

## 👤 حساب مدیر

حساب مدیر موجود — **`admin@reconciliation.ir`** (نقش `admin`) — به‌همراه هش bcrypt پسورد، درون `db/custom.db` ذخیره و در این ریپو کامیت شده است. پس از استقرار روی هر سرور جدید، **بدون نیاز به هیچ اقدام اضافه‌ای** با همان نام کاربری/رمز عبور قبلی وارد می‌شوید.

- bcrypt خود-بنیاد است (salt داخل هش) و به سرور/ماشین وابسته نیست.
- کوکی نشست با کلید `db/.app-secret` امضا می‌شود؛ چون این فایل هم منتقل می‌شود، رمزنگاری تنظیمات (مانند کلیدهای API هوش مصنوعی) پس از مهاجرت نیز معتبر می‌ماند.

## 🗄️ دیتابیس

- مسیر: `db/custom.db` (SQLite) — schema در `prisma/schema.prisma`
- **کامیت شدن دیتابیس عمدی است** تا استقرار روی سرور جدید بدون مهاجرت، همان حساب‌ها و داده‌ها را داشته باشد. ریپو خصوصی است؛ آن را عمومی نکنید.
- **پشتیبان‌گیری:** کافی است periodically از `db/custom.db` و `db/.app-secret` کپی بگیرید (سرویس را موقتاً متوقف کنید تا snapshot یکپارچه باشد).
- تغییر schema: `prisma/schema.prisma` را ویرایش و `bun run db:push` را اجرا کنید (قبل از اجرا از دیتابیس بکاپ بگیرید).

## 🔑 متغیرهای محیطی

| متغیر | الزامی | توضیح |
|---|---|---|
| `DATABASE_URL` | ✅ | مسیر فایل SQLite — پیش‌فرض: `file:./db/custom.db` (نمونه در `.env.example`) |
| `APP_SECRET` | ❌ | در صورت تنظیم، جایگزین `db/.app-secret` می‌شود (نشست‌های موجود و کلیدهای رمزشده قبلی باطل می‌شوند) |

## 🛡️ نکات امنیتی

- **این ریپو خصوصی است و حاوی داده عملیاتی است:** هرگز public نکنید؛ اگر لازم شد عمومی شود، اول `db/` را از تاریخچه git پاک کنید و `APP_SECRET` را rotate کنید.
- توکن‌های دسترسی (GitHub PAT و کلیدهای API) را **هرگز** در کد کامیت نکنید؛ توکنی که برای ساخت این ریپو استفاده شده، پس از اتمام کار از تنظیمات GitHub حذف/rotate شود.
- پسوردها با bcrypt (cost 12)؛ پس از ۵ تلاش ناموفق، حساب ۱۵ دقیقه قفل می‌شود.
- کلیدهای AI provider در دیتابیس با AES-256-GCM رمز می‌شوند و هرگز به کلاینت ارسال نمی‌شوند.
- هدرهای امنیتی (CSP، X-Frame-Options و…) در `next.config.ts` فعال‌اند.

## 🌐 زبان و راستا (i18n / RTL)

- دو زبان **فارسی (پیش‌فرض، RTL)** و **انگلیسی (LTR)** — سوییچ در لحظه بدون reload
- همه کامپوننت‌ها با **CSS Properties منطقی** (`ps/pe/ms/me/start/end`) نوشته شده‌اند تا در هر دو راستا درست چیده شوند
- آیکن‌های جهتی با `rtl:rotate-180` آینه می‌شوند و توکن‌های لاتین/عددی درون متن فارسی با `<bdi dir="ltr">` ایزوله شده‌اند
- پورتال‌های Radix (منو، دیالوگ، …) با `DirectionProvider` جهت می‌گیرند

## 📁 ساختار پروژه

```
├── prisma/schema.prisma      # اسکیمای دیتابیس
├── db/
│   ├── custom.db             # دیتابیس SQLite (کامیت‌شده — عمدی)
│   ├── .app-secret           # کلید امضای JWT / رمزنگاری (کامیت‌شده — عمدی)
│   ├── uploads/              # فایل‌های بارگذاری‌شده کاربران
│   └── fixtures/             # داده نمونه
├── src/
│   ├── app/                  # App Router — صفحه اصلی، API routes
│   ├── components/           # کامپوننت‌های ui (shadcn) و ویوها
│   └── lib/                  # auth، crypto، db، i18n و سرویس‌ها
├── Caddyfile                 # نمونه گیت‌وی (محیط سندباکس)
└── .env.example              # قالب متغیرهای محیطی
```

---

## 🇬🇧 English — Quick Start

**AI-powered reconciliation platform** (Persian-first, fully RTL/LTR bilingual): upload bank/ledger files (CSV/Excel/PDF), auto-match records with configurable rules, analyze discrepancies with AI, and manage users — built with Next.js 16, Tailwind 4, shadcn/ui, Prisma + SQLite.

```bash
git clone https://github.com/<YOUR_USER>/ai-reconciliation.git && cd ai-reconciliation
bun install
bunx prisma generate
cp .env.example .env        # DATABASE_URL=file:./db/custom.db works out of the box
bun run dev                 # development → http://localhost:3000
# production:
bun run build && bun run start
```

**Key facts**

- The **SQLite database (`db/custom.db`) is committed on purpose** (private repo) so the existing **admin account — `admin@reconciliation.ir`** — and all projects/settings transfer to any new server with zero migration steps. Password hashes are bcrypt (self-contained) and remain valid.
- `db/.app-secret` (committed) signs JWT sessions and decrypts AI provider API keys stored in the DB, so encrypted settings survive migration.
- **Do not make this repository public** without purging `db/` from git history and rotating secrets.
- For schema changes edit `prisma/schema.prisma` then run `bun run db:push` (⚠️ `--accept-data-loss`) — take a backup first.
- App listens on port `3000`; put it behind a reverse proxy (Caddy/nginx) with TLS for production.
- Back up by copying `db/custom.db` + `db/.app-secret` while the service is stopped.
