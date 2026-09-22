import { ChangeEvent, useEffect, useRef, useState } from "react";
import Input from "../../src/components/Input";
import Button from "../../src/components/Button";
import { postgrest } from "../../src/utils/postgrest";
import { usePageContext } from "vike-react/usePageContext";
import { saveAuth } from "../../src/utils/auth";
import { navigate } from "vike/client/router";

export default function () {
  const [form, setFormState] = useState({ email: "", password: "" });
  const ref = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const context = usePageContext();
  // The page is server-rendered, so the form exists before React has attached
  // onSubmit. Submitted in that window it fell back to a native GET and put the
  // password in the URL - browser history, proxy and server logs. Keep the button
  // disabled until hydration, and make the fallback a POST regardless.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const onSubmit = async () => {
    const isValid = ref.current?.checkValidity();
    if (!isValid) return;

    const { data, error } = await postgrest.rpc("login", form);
    if (error) {
      setMessage("invalid username or password");
      return;
    }
    saveAuth(context, data);
    await navigate("/");
  };

  const _setFormState = (ev: ChangeEvent<HTMLInputElement>) =>
    setFormState({ ...form, [ev.target.name]: ev.target.value });

  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center">
      <form
        ref={ref}
        method="post"
        onSubmit={(ev) => {
          ev.preventDefault();
          onSubmit();
        }}
        className="mx-auto max-w-lg w-full flex flex-col gap-3 place-items-center p-8 rounded-md shadow-md px-12"
      >
        <div className="text-lg">Login</div>
        <div>Welcome Back</div>
        {message && <div className="text-red-500 text-sm">{message}</div>}
        <Input
          required
          name="email"
          placeholder="email"
          type="email"
          autoComplete="username"
          onChange={_setFormState}
        />
        <Input
          required
          name="password"
          placeholder="password"
          type="password"
          autoComplete="current-password"
          onChange={_setFormState}
        />
        <Button title="Login" className="bg-green-500" disabled={!hydrated} />
      </form>
    </div>
  );
}
