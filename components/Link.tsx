import { usePageContext } from "vike-react/usePageContext";

export function Link(
  { href, children }: {
    href: string;
    children: string;
  },
) {
  const pageContext = usePageContext();
  const { urlPathname } = pageContext;
  const isActive = href === "/"
    ? urlPathname === href
    : urlPathname.startsWith(href);
  return (
    <a
      href={href}
    >
      <div
        className={`${
          isActive ? "bg-zinc-100" : "bg-white"
        } hover:bg-zinc-100 px-3 py-1 text-sm rounded-md w-full`}
      >
        {children}
      </div>
    </a>
  );
}
