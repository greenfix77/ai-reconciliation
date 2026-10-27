import { Locale } from '../../types'

/** [dashboard namespace] Owned by agent task 2-a. Flat keys prefixed with 'dashboard.' — FA & EN required. */
export const DASHBOARD_DICT: Record<Locale, Record<string, string>> = {
  fa: {
    // Welcome header
    'dashboard.welcome.title': 'به داشبورد خوش آمدید!',
    'dashboard.welcome.subtitle': 'مدیریت پرونده‌ها و مشاهده سریع نتایج مغایرت‌گیری',
    'dashboard.welcome.updated': 'به‌روزرسانی خودکار',

    // Stat cards
    'dashboard.stats.successTx': 'تعداد تراکنش‌های موفق',
    'dashboard.stats.discrepancies': 'تعداد مغایرت‌ها',
    'dashboard.stats.reports': 'گزارش‌ها',
    'dashboard.stats.matchRate': 'درصد تطبیق',
    'dashboard.stats.trendHint': 'نسبت به ۷ روز گذشته',
    'dashboard.unit.percent': '٪',

    // AI banner
    'dashboard.ai.chip': 'دستیار هوشمند',
    'dashboard.ai.title': 'قدرت هوشمند در دستان شما',
    'dashboard.ai.subtitle': 'قابلیت هوشمند در دستان شما برای تحلیل سریع مغایرت‌ها و ایجاد پرونده جدید',
    'dashboard.ai.cta': 'ایجاد پرونده جدید',
    'dashboard.ai.secondary': 'مشاهده مغایرت‌ها',

    // Donut
    'dashboard.donut.title': 'وضعیت نتایج پرونده‌ها',
    'dashboard.donut.subtitle': 'توزیع پرونده‌ها بر اساس وضعیت',
    'dashboard.donut.centerLabel': 'کل گزارش‌ها',
    'dashboard.donut.filterAll': 'همه پرونده‌ها',
    'dashboard.donut.empty': 'پرونده‌ای برای نمایش وجود ندارد',

    // Trend chart
    'dashboard.trend.title': 'روند مغایرت‌ها در ۷ روز اخیر',
    'dashboard.trend.subtitle': 'مقایسه روزانه مغایرت‌ها و تطبیق‌ها',
    'dashboard.trend.discrepancies': 'مغایرت‌ها',
    'dashboard.trend.matches': 'تطبیق‌ها',
    'dashboard.trend.range7': '۷ روز اخیر',
    'dashboard.trend.range14': '۱۴ روز اخیر',
    'dashboard.trend.range30': '۳۰ روز اخیر',
    'dashboard.trend.empty': 'داده‌ای برای نمایش وجود ندارد',

    // Latest cases table
    'dashboard.table.title': 'آخرین پرونده‌ها',
    'dashboard.table.subtitle': 'آخرین پرونده‌های ثبت‌شده شما',
    'dashboard.table.col.name': 'نام پروژه',
    'dashboard.table.col.category': 'دسته‌بندی',
    'dashboard.table.col.status': 'وضعیت',
    'dashboard.table.col.progress': 'پیشرفت',
    'dashboard.table.col.date': 'تاریخ',
    'dashboard.table.emptyTitle': 'هنوز پرونده‌ای ثبت نشده است',
    'dashboard.table.emptyBody': 'با ایجاد اولین پرونده، نتایج مغایرت‌گیری را اینجا ببینید',
    'dashboard.table.open': 'مشاهده پرونده',

    // Status badges
    'dashboard.status.completed': 'تکمیل‌شده',
    'dashboard.status.review': 'در حال بررسی',
    'dashboard.status.failed': 'ناموفق',
    'dashboard.status.archived': 'بایگانی',

    // Quick actions
    'dashboard.quick.title': 'عملیات سریع',
    'dashboard.quick.subtitle': 'دسترسی سریع به پرکاربردترین ابزارها',
    'dashboard.quick.reports': 'گزارش هوشمند',
    'dashboard.quick.reportsSub': 'تحلیل و خروجی گزارش‌ها',
    'dashboard.quick.assistant': 'دستیار هوشمند',
    'dashboard.quick.assistantSub': 'گفت‌وگو با دستیار AI',
    'dashboard.quick.reconciliation': 'مغایرت‌یابی',
    'dashboard.quick.reconciliationSub': 'اجرای تطبیق تراکنش‌ها',
    'dashboard.quick.aiSettings': 'تنظیمات AI',
    'dashboard.quick.aiSettingsSub': 'مدیریت ارائه‌دهندگان',
    'dashboard.quick.newCase': 'پرونده جدید',
    'dashboard.quick.newCaseSub': 'ایجاد پرونده مغایرت‌گیری',

    // Overall stats
    'dashboard.overall.title': 'آمار کلی',
    'dashboard.overall.subtitle': 'نمای کلی فضای کاری شما',
    'dashboard.overall.totalProjects': 'کل پرونده‌ها',
    'dashboard.overall.pendingReview': 'در انتظار بررسی',
    'dashboard.overall.activeProjects': 'پروژه فعال',
    'dashboard.overall.currentFiles': 'پرونده جاری',

    // Showcase strip
    'dashboard.showcase.title': 'قابلیت‌های موبایل',
    'dashboard.showcase.subtitle': 'نمای اپلیکیشن در موبایل — همه امکانات همیشه همراه شما',
    'dashboard.showcase.item1': '۱. صفحه پرونده‌ها',
    'dashboard.showcase.item2': '۲. ایجاد پرونده جدید',
    'dashboard.showcase.item3': '۳. آپلود فایل‌ها و تنظیمات',
    'dashboard.showcase.item4': '۴. نتایج مغایرت‌یابی',
    'dashboard.showcase.item5': '۵. نمایش مغایرت‌یابی',
    'dashboard.showcase.item6': '۶. صفحه جزئیات مغایرت',
    'dashboard.showcase.item7': '۷. صفحه جزئیات پرونده',
    'dashboard.showcase.item8': '۸. قابلیت‌های موبایل + دستیار هوشمند',

    // Footer
    'dashboard.footer.tagline': 'یک تجربه ساده، سریع و هوشمند برای مغایرت‌گیری مالی',
    'dashboard.footer.accuracy': 'دقت بالا',
    'dashboard.footer.security': 'امنیت اطلاعات',
    'dashboard.footer.ai': 'هوش مصنوعی',
    'dashboard.footer.instant': 'دسترسی آنی',

    // Error state
    'dashboard.error.title': 'خطا در بارگذاری داشبورد',
    'dashboard.error.body': 'در دریافت آمار مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
  },
  en: {
    // Welcome header
    'dashboard.welcome.title': 'Welcome to your dashboard!',
    'dashboard.welcome.subtitle': 'Manage cases and quickly view reconciliation results',
    'dashboard.welcome.updated': 'Auto-refreshed',

    // Stat cards
    'dashboard.stats.successTx': 'Successful transactions',
    'dashboard.stats.discrepancies': 'Discrepancies',
    'dashboard.stats.reports': 'Reports',
    'dashboard.stats.matchRate': 'Match rate',
    'dashboard.stats.trendHint': 'vs last 7 days',
    'dashboard.unit.percent': '%',

    // AI banner
    'dashboard.ai.chip': 'AI Assistant',
    'dashboard.ai.title': 'Smart power in your hands',
    'dashboard.ai.subtitle': 'Smart assistance to quickly analyze discrepancies and create new cases',
    'dashboard.ai.cta': 'Create new case',
    'dashboard.ai.secondary': 'View discrepancies',

    // Donut
    'dashboard.donut.title': 'Case results status',
    'dashboard.donut.subtitle': 'Distribution of cases by status',
    'dashboard.donut.centerLabel': 'Total reports',
    'dashboard.donut.filterAll': 'All cases',
    'dashboard.donut.empty': 'No cases to display',

    // Trend chart
    'dashboard.trend.title': 'Discrepancy trend — last 7 days',
    'dashboard.trend.subtitle': 'Daily comparison of discrepancies and matches',
    'dashboard.trend.discrepancies': 'Discrepancies',
    'dashboard.trend.matches': 'Matches',
    'dashboard.trend.range7': 'Last 7 days',
    'dashboard.trend.range14': 'Last 14 days',
    'dashboard.trend.range30': 'Last 30 days',
    'dashboard.trend.empty': 'No data to display',

    // Latest cases table
    'dashboard.table.title': 'Latest cases',
    'dashboard.table.subtitle': 'Your most recently updated cases',
    'dashboard.table.col.name': 'Project name',
    'dashboard.table.col.category': 'Category',
    'dashboard.table.col.status': 'Status',
    'dashboard.table.col.progress': 'Progress',
    'dashboard.table.col.date': 'Date',
    'dashboard.table.emptyTitle': 'No cases yet',
    'dashboard.table.emptyBody': 'Create your first case to see reconciliation results here',
    'dashboard.table.open': 'Open case',

    // Status badges
    'dashboard.status.completed': 'Completed',
    'dashboard.status.review': 'Under review',
    'dashboard.status.failed': 'Failed',
    'dashboard.status.archived': 'Archived',

    // Quick actions
    'dashboard.quick.title': 'Quick actions',
    'dashboard.quick.subtitle': 'Quick access to your most-used tools',
    'dashboard.quick.reports': 'Smart reports',
    'dashboard.quick.reportsSub': 'Analyze & export reports',
    'dashboard.quick.assistant': 'AI assistant',
    'dashboard.quick.assistantSub': 'Chat with the AI assistant',
    'dashboard.quick.reconciliation': 'Reconciliation',
    'dashboard.quick.reconciliationSub': 'Run transaction matching',
    'dashboard.quick.aiSettings': 'AI settings',
    'dashboard.quick.aiSettingsSub': 'Manage AI providers',
    'dashboard.quick.newCase': 'New case',
    'dashboard.quick.newCaseSub': 'Create a reconciliation case',

    // Overall stats
    'dashboard.overall.title': 'Overall statistics',
    'dashboard.overall.subtitle': 'Overview of your workspace',
    'dashboard.overall.totalProjects': 'Total cases',
    'dashboard.overall.pendingReview': 'Pending review',
    'dashboard.overall.activeProjects': 'Active cases',
    'dashboard.overall.currentFiles': 'Current files',

    // Showcase strip
    'dashboard.showcase.title': 'Mobile capabilities',
    'dashboard.showcase.subtitle': 'The app on mobile — everything with you, always',
    'dashboard.showcase.item1': '1. Cases screen',
    'dashboard.showcase.item2': '2. Create new case',
    'dashboard.showcase.item3': '3. Upload files & settings',
    'dashboard.showcase.item4': '4. Reconciliation results',
    'dashboard.showcase.item5': '5. Reconciliation view',
    'dashboard.showcase.item6': '6. Discrepancy details',
    'dashboard.showcase.item7': '7. Case details',
    'dashboard.showcase.item8': '8. Mobile + AI assistant',

    // Footer
    'dashboard.footer.tagline': 'A simple, fast and smart financial reconciliation experience',
    'dashboard.footer.accuracy': 'High accuracy',
    'dashboard.footer.security': 'Data security',
    'dashboard.footer.ai': 'Artificial intelligence',
    'dashboard.footer.instant': 'Instant access',

    // Error state
    'dashboard.error.title': 'Failed to load dashboard',
    'dashboard.error.body': 'Something went wrong while loading stats. Please try again.',
  },
}
