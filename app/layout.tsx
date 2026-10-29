import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import "./globals.css";
const NAME = process.env.NEXT_PUBLIC_COMMUNITY_NAME || "Brookhaven RP";
export const metadata: Metadata = { title: `${NAME} — Staff Applications`, description: `Apply to join the ${NAME} staff team.` };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-navy-950">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
          <Link href="/" className="flex items-center gap-2 font-semibold"><Shield className="h-5 w-5 text-accent" aria-hidden />{NAME}</Link>
          <div className="flex items-center gap-4 text-sm text-muted">
            <Link href="/#positions" className="hover:text-white">Positions</Link>
            <Link href="/#process" className="hover:text-white">Process</Link>
            <Link href="/#faq" className="hover:text-white">FAQ</Link>
            <Link href="/apply" className="btn btn-primary">Apply for Staff</Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 py-6 text-center text-xs text-muted">
        <p>{NAME} is an independent community and is not affiliated with Roblox Corporation.</p>
        <p className="mt-1"><Link href="/#privacy" className="underline">Privacy Policy</Link> · <Link href="/#terms" className="underline">Terms</Link></p>
      </footer>
    </body></html>
  );
}
