# Leon

Bilingual (English / فارسی) crypto chart analyst. Live Binance candles, 10 strategies backtested live and ranked by win rate per horizon (Long range / Mid range / Scalping) and timeframe, spot BUY/SELL calls and futures Open/Close Long/Short calls.

> Signals are statistical, not financial advice. Paper-trade first.

## What's new in 1.4.0

- **Accuracy upgrade**: a strict signal filter (trade only with the EMA200 trend + ADX, range strategies only in calm markets, skip low-volume and spike candles), plus walk-forward tuning of stop and target per strategy, coin and timeframe.
- **Honest win rate**: tuning uses the older 70% of candles; the win rate in the dial and the table is measured on the newest 30% the tuner never saw. "Proven" badge = 10+ unseen trades, win rate >= 50%, profit factor >= 1.1. "Only proven strategies" filter.
- **Leon Elite**: a consensus strategy built from the 4 best-tested strategies (fires only when 2+ agree and none disagrees). Alerts default to Proven + Elite.
- **Optimize for Accuracy or Profit**: accuracy uses closer targets (higher win rate, smaller wins); profit uses wider targets.
- **Recent points panel fixed**: "50 found" is the number of signals, shown apart from their accuracy; every point shows Target hit / Stop loss.

## What's new in 1.3.0

- **Signal sound alerts** (Windows, macOS, Android, iOS): the moment a strategy finds a new BUY or SELL point on the candle that just closed, Leon plays a sound (BUY = rising notes, SELL = falling notes), vibrates the phone and shows a pop-up. Bell button in the header: mute, pick "Selected strategy / Pro strategies / Every strategy", sound, volume, test buttons. On desktop it keeps ringing while minimised and can show a system notification.
- **At least 50 recent points per strategy**: Leon now loads older candles automatically (up to 12,000) until every strategy has found 50+ recent buy/sell points. All points are drawn on the chart, the 50th is marked, and a new "Recent buy / sell points" panel lists them. If the exchange simply has less history (e.g. weekly candles of a new coin), Leon says so.
- **20 strategies** (10 new: Bollinger Reversion, Stoch RSI Dip, Ichimoku Cloud, Parabolic SAR + EMA200, Connors RSI-2, Engulfing + EMA50, EMA Ribbon 5·8·13, CCI ±100, Structure Break (BOS), DMI + ADX). All 10 old ones are kept.
- **"Best for" trading style** on every strategy (Scalping, Day trading, Swing, Position / trend, Range), a filter above the strategy table and a "Which strategy for which trade" guide.

> Phones: alerts ring while Leon is open on screen. iOS mutes app sounds when the silent switch is on.

## What's new in 1.2.0

- **Test account**: pick any starting balance (100 to 100,000 USDT or custom), fee, spot or futures, leverage and size. Stops, targets and liquidation are simulated. "Strategy test in money" shows how each strategy would have done with your balance.
- **Real exchanges**: Binance, Bybit, OKX, KuCoin, Bitget and Toobit (spot and USDT futures). Keys are encrypted with your PIN (AES-256, PBKDF2) on this device only. Use read + trade keys, never withdrawal.
- **Bots**: run one strategy on one coin on the test account or a real account. Bots ask before each live order by default. Safety rails: max margin per order, daily loss limit that pauses live trading.
- **Mobile**: Capacitor project for Android and iOS (`npm run mobile:init`, then `npm run android` or `npm run ios`). Exchange calls use the native HTTP layer there.

> Live trading can lose money fast. Test on the test account first, start with small size, and keep Leon open while bots run (stops are watched by the app).

## Build Windows + Mac apps with GitHub (no coding needed)

1. Create a free account at github.com, then click **New repository**, name it `leon`, click **Create repository**.
2. On the new repo page click **uploading an existing file**. Unzip `leon-desktop.zip` on your computer and drag **everything inside the folder** (including the hidden `.github` folder) into the page. Click **Commit changes**.
   - Mac: press `Cmd + Shift + .` in Finder to see hidden folders. Windows: View → Show → Hidden items.
3. Open the **Actions** tab → **Build Leon (Windows + macOS)** → **Run workflow**.
4. Wait about 10 minutes until both jobs are green. Open the run, scroll to **Artifacts**, download:
   - `Leon-windows-latest` → `Leon Setup 1.4.0.exe` (installer) and a portable `.exe`
   - `Leon-macos-latest` → `Leon-1.4.0-arm64.dmg` (Apple Silicon) and `Leon-1.4.0.dmg` (Intel)
5. Want a proper Release page? Go to **Releases → Draft a new release**, create tag `v1.4.0`, publish. The build runs again and attaches the installers to the release.

First launch on Mac: the app is unsigned, so right-click Leon → **Open** → **Open**. On Windows, SmartScreen may warn: **More info → Run anyway**.

## Run on your own computer (optional)

Install Node.js 20 from nodejs.org, then in this folder: `npm install` and `npm run app`.

---

# لئون (Leon)

## تازه‌های نسخه ۱.۴.۰

- **افزایش دقت**: فیلتر سخت‌گیرانه سیگنال (فقط هم‌جهت با روند EMA200 و ADX، استراتژی‌های رنج فقط در بازار آرام، حذف کندل‌های کم‌حجم و کندل‌های جهشی) و تنظیم خودکار حد ضرر و حد سود برای هر استراتژی، ارز و تایم‌فریم.
- **نرخ برد واقعی**: تنظیم روی ۷۰٪ قدیمی‌تر کندل‌ها انجام می‌شود و نرخ برد روی ۳۰٪ جدیدتر سنجیده می‌شود که تنظیم‌کننده ندیده است. نشان «تأییدشده» و فیلتر «فقط استراتژی‌های تأییدشده».
- **لئون الیت**: استراتژی اجماعی از ۴ استراتژی برتر.
- **بخش نقاط اصلاح شد**: «۵۰ نقطه پیدا شد» یعنی تعداد سیگنال؛ دقت همان نقاط جدا نشان داده می‌شود و هر نقطه حد سود یا حد ضرر خوردنش را نشان می‌دهد.

## تازه‌های نسخه ۱.۳.۰

- **هشدار صوتی سیگنال** (ویندوز، مک، اندروید، آیفون): به محض اینکه یک استراتژی نقطه خرید یا فروش جدید روی کندلِ تازه بسته‌شده پیدا کند، صدا پخش می‌شود (خرید = صدای رو به بالا، فروش = رو به پایین)، گوشی می‌لرزد و یک پیام کوچک نشان داده می‌شود. از دکمه زنگ بالای صفحه می‌توانی صدا را قطع کنی، انتخاب کنی برای کدام استراتژی‌ها زنگ بزند، نوع صدا و بلندی را عوض کنی و تست کنی.
- **حداقل ۵۰ نقطه اخیر برای هر استراتژی**: برنامه خودکار کندل‌های قدیمی‌تر را (تا ۱۲٬۰۰۰ کندل) بارگذاری می‌کند تا هر استراتژی حداقل ۵۰ نقطه خرید/فروش اخیر پیدا کند. همه نقاط روی نمودار نشان داده می‌شوند و بخش «نقاط خرید و فروش اخیر» لیستشان را نشان می‌دهد.
- **۲۰ استراتژی**: همه ۱۰ استراتژی قبلی حفظ شده و ۱۰ استراتژی جدید اضافه شده است.
- **«مناسب برای»**: کنار هر استراتژی نوشته شده برای چه نوع معامله‌ای مناسب است (اسکالپ، معامله روزانه، نوسان‌گیری، بلندمدت/روندی، رنج) و بخش «کدام استراتژی برای کدام نوع معامله» اضافه شده است.


۱. در سایت گیت‌هاب (GitHub) حساب بساز، روی «New repository» بزن، اسمش را `leon` بگذار و «Create repository» را بزن.
۲. روی «uploading an existing file» بزن. فایل زیپ (zip) را باز کن و **همه محتوای پوشه** (حتی پوشه مخفی `.github`) را داخل صفحه بکش و «Commit changes» را بزن.
   - در مک (Mac): در فایندر (Finder) کلیدهای `Cmd + Shift + .` را بزن تا پوشه‌های مخفی دیده شوند. در ویندوز (Windows): «View → Show → Hidden items».
۳. برو به تب «Actions»، روی «Build Leon (Windows + macOS)» و بعد «Run workflow» بزن.
۴. حدود ۱۰ دقیقه صبر کن تا هر دو سبز شوند. داخل همان اجرا، پایین صفحه در بخش «Artifacts» فایل‌ها را دانلود کن:
   - «Leon-windows-latest»: نصب‌کننده ویندوز (`.exe`)
   - «Leon-macos-latest»: فایل مک (`.dmg`) برای اپل سیلیکون (arm64) و اینتل (Intel)
۵. اولین اجرا در مک: روی برنامه راست‌کلیک کن، «Open» و دوباره «Open». در ویندوز اگر هشدار آمد: «More info → Run anyway».

داده قیمت‌ها زنده از بایننس (Binance) می‌آید و کلید (API key) لازم نیست. اگر ارزی در بایننس نباشد یا اینترنت محدود باشد، برنامه خودکار به حالت نمایشی (demo) می‌رود.
