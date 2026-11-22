import BottomNav from "@/components/blocks/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mt-20">
      {children}
      <BottomNav />
    </main>
  );
}

