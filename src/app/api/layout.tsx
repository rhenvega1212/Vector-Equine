// Force all API routes to be dynamic (they use cookies/auth)
export const dynamic = "force-dynamic";

export default function ApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
