import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notte live view embed",
  description: "Embed the live view of a Notte browser session in an iframe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
