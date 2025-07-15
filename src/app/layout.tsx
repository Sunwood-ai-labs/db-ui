import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

// Force dynamic rendering for the entire app since it's a database management tool
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Database UI",
  description: "A simple database UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <Sidebar />
            <SidebarInset>
              <header className="flex h-16 shrink-0 items-center gap-2 px-4">
                <SidebarTrigger
                  data-testid="sidebar-trigger"
                  className="-ml-1"
                />
              </header>
              <main className="overflow-x-hidden">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
