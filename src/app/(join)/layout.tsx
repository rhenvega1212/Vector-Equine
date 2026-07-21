export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-navy text-cream">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-8">
        {children}
      </div>
    </div>
  );
}
