import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarLayout } from "./components/SidebarLayout";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MedSync – Smart Healthcare Platform",
  description: "AI-powered patient management, medical records, and symptom diagnostics platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <SidebarLayout>{children}</SidebarLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
