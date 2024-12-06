const POSTGRES_URI = process.env.NODE_ENV == "development"
    ? "http://localhost:3000/rest"
    : "https://admin.prep50.ng/rest";
export { POSTGRES_URI };
