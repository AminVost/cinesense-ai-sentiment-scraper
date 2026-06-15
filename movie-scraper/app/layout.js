import "./globals.css";
import "bootstrap/dist/css/bootstrap.min.css";

export const metadata = {
  title: "Movie Scraper - Extract Comments from Websites",
  description: "Movie Scraper allows you to scrape comments from movie websites easily and efficiently.",
  keywords: ["movie scraper", "comment extractor", "web scraping"],
  applicationName: "Movie Scraper",
  authors: [{ name: "Your Name", url: "https://yourdomain.com" }],
  generator: "Next.js 15",
  openGraph: {
    title: "Movie Scraper",
    description: "Scrape movie comments with ease!",
    url: "https://yourdomain.com",
    siteName: "Movie Scraper",
    images: [
      {
        url: "https://yourdomain.com/preview-image.jpg",
        width: 1200,
        height: 630,
        alt: "Movie Scraper Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Movie Scraper",
    description: "Scrape movie comments from websites easily and efficiently.",
    images: ["https://yourdomain.com/preview-image.jpg"],
  },
  robots: "index, follow",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}