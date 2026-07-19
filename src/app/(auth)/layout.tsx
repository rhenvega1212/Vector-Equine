import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-[#0B1220] p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <Image
          src="/logo-mark.png"
          alt="Vector Equine"
          width={120}
          height={90}
          priority
          className="mb-8 h-16 w-auto"
        />
        {children}
      </div>
    </div>
  );
}
