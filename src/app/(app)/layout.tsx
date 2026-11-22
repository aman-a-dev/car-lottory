import BottomNav from "@/components/blocks/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <main>
      {children}
      <BottomNav />
    </main>
  );
}

