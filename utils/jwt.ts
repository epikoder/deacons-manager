import jose from "jose";
import { PageContext } from "vike/types";

const defaultSignConfig = (context: PageContext): SignConfig => ({
  subject: "access_token",
  role: "anon",
  duration: 30,
  key: context.config.key,
});

interface SignConfig {
  subject: string;
  role: string;
  duration: number; // minutes
  key: any;
}

const signJWT = async (context: PageContext, data: any, config: SignConfig) => {
  const _config = Object.assign(
    Object.assign({}, defaultSignConfig(context)),
    config,
  );
  const jwt = await new jose.SignJWT({
    role: _config.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(JSON.stringify(data))
    .setSubject(_config.subject)
    .setExpirationTime(`${_config.duration}minutes`)
    .setNotBefore(new Date())
    .sign(new TextEncoder().encode(_config.key));
};

const verifyJWT = async (context: PageContext, payload: string) => {
  const jwtResult = await jose.jwtVerify(
    payload,
    new TextEncoder().encode(context.config.key),
  );

  if (!jwtResult.payload) {
    return null;
  }
  return jwtResult.payload;
};
