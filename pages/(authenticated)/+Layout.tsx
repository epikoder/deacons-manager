import React, { useEffect } from "react";
import { Link } from "../../components/Link";
import OrderService from "../../services/orders.service/orders.service";
import { sourceV1 } from "../../services/orders.service/sources";
import { usePageContext } from "vike-react/usePageContext";
import Badge from "../../components/Badge";
import Carbon from "../../utils/carbon";
import Logo from "../../components/Logo";

export default function LayoutDefault({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = usePageContext();

  if (!context.config.ready) return <></>;

  useEffect(() => {
    const orderService = OrderService.instance;
    orderService.registerSource(
      "Prep50Book",
      sourceV1("https://prep50book.prep50mobileapp.com.ng/api.php"),
      new Carbon(2024, 11, 1),
    );
    orderService.registerSource(
      "Prep50BookList",
      sourceV1("https://prep50booklist.prep50mobileapp.com.ng//api.php"),
      new Carbon(2024, 11, 1),
    );
    orderService.registerSource(
      "Nkemobi",
      sourceV1("https://nkemobi.prep50mobileapp.com.ng/api.php"),
      new Carbon(2024, 11, 1),
    );
    orderService.init().then((service) => {
      service.start();
    });
  }, []);

  return (
    <div className="flex max-w-screen-xl mx-auto w-screen h-screen overflow-hidden">
      <Sidebar>
        <Logo />
        <Link href="/">Dashboard</Link>
        <Badge subscriber={OrderService.instance.notification}>
          <Link href="/orders">Orders</Link>
        </Badge>
        <Link href="/affiliates">Affiliates</Link>
        <Link href="/agents">Agents</Link>
        <Link href="/settings">Settings</Link>
      </Sidebar>
      <Content>{context.config.bookCost && children}</Content>
    </div>
  );
}

function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="sidebar"
      className="p-5 flex flex-col gap-2 flex-shrink-0"
      style={{
        lineHeight: "1.8em",
        borderRight: "2px solid #eee",
      }}
    >
      {children}
    </div>
  );
}

function Content({ children }: { children: React.ReactNode }) {
  return (
    <div id="page-container" className="w-full">
      <div
        id="page-content"
        className="h-screen overflow-hidden w-full"
      >
        {children}
      </div>
    </div>
  );
}
