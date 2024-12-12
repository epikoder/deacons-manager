import logoUrl from "../assets/logo.png";

export default function Logo({ url }: { url?: string }) {
    return (
        <div
            className="mx-auto w-fit"
            style={{
                marginTop: 20,
                marginBottom: 10,
            }}
        >
            <a href={url ?? "/"}>
                <img src={logoUrl} height={64} width={64} alt="logo" />
            </a>
        </div>
    );
}
