import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { isPharmacist } from "@/lib/actions/auth";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAdmin = await isPharmacist();

  return (
    <>
      <Header showAdmin={showAdmin} />
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 lg:px-6">
        <main className="min-w-0">{children}</main>
      </div>
      <Footer />
    </>
  );
}
