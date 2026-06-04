import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Finance · Invoice Portal",
  description: "Look up any invoice, anytime.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="bg-[#FDFCFB] font-jakarta text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
