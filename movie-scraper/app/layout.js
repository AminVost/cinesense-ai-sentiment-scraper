import "./globals.css";
import "@fontsource-variable/estedad/wght.css";

export const metadata = {
  title: "CineSense — Frame Room | اتاق تحلیل فیلم",
  description: "تحلیل احساسات کاربران درباره فیلم‌ها از منابع مختلف با هوش مصنوعی محلی.",
  applicationName: "CineSense",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
