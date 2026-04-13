import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-6 px-4 lg:px-6">
        {/* Chat sidebar — left, desktop only */}
        <ChatSidebar />
        {/* Main content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Footer />
    </>
  );
}
