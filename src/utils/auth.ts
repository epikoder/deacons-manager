export { AUTH_KEY, makeUser, saveAuth, saveAuthToken };

import * as jose from "jose";
import { PageContext } from "vike/types";

const AUTH_KEY = "auth";
const saveAuth = (pageContext: PageContext, data: any) => {
  const user = makeUser(data);
  sessionStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      access_token: data.access_token,
      user,
    }),
  );
  localStorage.setItem(AUTH_KEY, data.refresh_token);
  sessionStorage.setItem(AUTH_KEY + "_user", JSON.stringify(user));
};

const saveAuthToken = (data: any) => {
  const user = makeUser(data);
  sessionStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      access_token: data.access_token,
      user,
    }),
  );
  localStorage.setItem(AUTH_KEY, data.refresh_token);
  sessionStorage.setItem(AUTH_KEY + "_user", JSON.stringify(user));
};

const makeUser = (data: any): User => {
  const payload = jose.decodeJwt(data.access_token) as jose.JWTPayload & {
    user: {
      id: string;
      email: string;
      role: string;
      user_raw_meta_data: Record<string, any>;
      app_meta_data: Record<string, any>;
    };
  };
  const u = payload.user;
  return {
    fullname: (u.user_raw_meta_data.lname && u.user_raw_meta_data.fname)
      ? `${u.user_raw_meta_data.lname} ${u.user_raw_meta_data.fname}`
      : u.email.split("@")[0],
    ...u,
  } satisfies User;
};
