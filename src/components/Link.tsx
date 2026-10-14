import { usePageContext } from "vike-react/usePageContext";

export function Link(
  { href, children, exact, icon }: {
    href: string;
    children: string;
    exact?: boolean;
    icon?: React.ReactNode;
  },
) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const isActive = href === "/" || exact
    ? urlPathname === href
    : urlPathname.startsWith(href);
  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
    >
      <div
        className={`${
          isActive
            ? "bg-green-50 text-green-700 font-medium"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        } flex items-center gap-2.5 px-3 py-1.5 text-sm rounded-lg w-full transition-colors`}
      >
        {icon && <span className="shrink-0 [&>svg]:size-[18px]">{icon}</span>}
        {children}
      </div>
    </a>
  );
}
