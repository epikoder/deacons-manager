import React, { useEffect } from "react";
import { Link } from "../../src/components/Link";
import OrderService from "../../src/services/orders.service/orders.service";
import {
	sourceUsingJambWaec,
	sourceUsingProductTable,
} from "../../src/services/orders.service/sources";
import { usePageContext } from "vike-react/usePageContext";
import Badge from "../../src/components/Badge";
import Carbon from "../../src/utils/carbon";
import Logo from "../../src/components/Logo";

export default function ({ children }: { children: React.ReactNode }) {
	const context = usePageContext();

	if (!context.config.ready) return <></>;

	useEffect(() => {
		const orderService = OrderService.instance;
		orderService.registerSource(
			"Prep50Book",
			sourceUsingJambWaec("https://prep50book.prep50mobileapp.com.ng/api.php"),
			"https://prep50book.prep50mobileapp.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Prep50BookList",
			sourceUsingJambWaec(
				"https://prep50booklist.prep50mobileapp.com.ng/api.php",
			),
			"https://prep50booklist.prep50mobileapp.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Prep50BookSales",
			sourceUsingJambWaec("https://prep50sales.prep50mobileapp.com.ng/api.php"),
			"https://prep50sales.prep50mobileapp.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Prep50BookList",
			sourceUsingJambWaec(
				"https://prep50booklist.prep50mobileapp.com.ng/api.php",
			),
			"https://prep50booklist.prep50mobileapp.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Nkemobi",
			sourceUsingJambWaec("https://nkemobi.prep50mobileapp.com.ng/api.php"),
			"https://nkemobi.prep50mobileapp.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Mommacare",
			sourceUsingJambWaec("https://mommacare.com.ng/api.php"),
			"https://mommacare.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Arinze",
			sourceUsingProductTable("https://arinze.prep50.com.ng/api/orders_v1"),
			"https://arinze.prep50.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Nnacho",
			sourceUsingProductTable("https://nnacho.prep50.com.ng/api/orders_v1"),
			"https://nnacho.prep50.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Emeka",
			sourceUsingProductTable("https://emeka.prep50.com.ng/api/orders_v1"),
			"https://emeka.prep50.com.ng",
			new Carbon(2024, 11, 1),
		);

		orderService.registerSource(
			"Ella",
			sourceUsingProductTable("https://ella.prep50.com.ng/api/orders_v1"),
			"https://ella.prep50.com.ng",
			new Carbon(2025, 8, 1),
		);

		orderService.registerSource(
			"Nanyalove",
			sourceUsingJambWaec("https://nanyalove.com.ng/api.php"),
			"https://nanyalove.com.ng",
			new Carbon(2025, 4, 1),
		);

		orderService.registerSource(
			"Winbest",
			sourceUsingJambWaec("https://www.winbestinternational.com.ng/api.php"),
			"https://www.winbestinternational.com.ng",
			new Carbon(2025, 4, 1),
		);
		orderService.init().then((service) => {
			service.start();
		});

		return () => orderService.stopBackgroundPull();
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
				{context.config.user!.role === "admin" && (
					<Link href="/users">Users</Link>
				)}
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
			<div id="page-content" className="h-screen overflow-hidden w-full">
				{children}
			</div>
		</div>
	);
}
