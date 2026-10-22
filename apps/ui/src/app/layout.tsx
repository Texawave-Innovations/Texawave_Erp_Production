import type { Metadata } from "next";
import { Nunito_Sans, Merriweather } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TexaOne ERP",
  description: "TexaOne ERP Enterprise Management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunitoSans.variable} ${merriweather.variable} font-sans h-full antialiased`}
      style={
        {
          "--font-jetbrains-mono": "var(--font-nunito-sans)",
          "--font-mono": "var(--font-nunito-sans)",
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
