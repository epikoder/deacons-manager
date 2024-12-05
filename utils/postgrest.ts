export { postgrest };

import {
  PostgrestBuilder,
  PostgrestClient,
  PostgrestFilterBuilder,
  PostgrestSingleResponse,
} from "@supabase/postgrest-js";
import { GenericSchema } from "../node_modules/@supabase/postgrest-js/src/types";
import { POSTGRES_URI } from "../pages/credentials.shared";
import { AUTH_KEY, saveAuthToken } from "./auth";
import { navigate } from "vike/client/router";
import { PG_UNAUTHORIZED } from "./constants";
import OrderService from "../services/orders.service/orders.service";

const postgrest = new PostgrestClient(POSTGRES_URI);

let isRefreshing = false;
const refreshQueue: VoidFunction[] = [];

export class WithAuth<
  Schema extends GenericSchema,
  Row extends Record<string, unknown>,
  Result,
  RelationName = unknown,
  Relationships = unknown,
> {
  constructor(
    filter:
      | PostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships>
      | PostgrestBuilder<Result>,
  ) {
    this._inner = filter;
  }

  private _inner:
    | PostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships>
    | PostgrestBuilder<Result>;

  async unwrap(): Promise<PostgrestSingleResponse<Result>> {
    const k = sessionStorage.getItem(AUTH_KEY);
    if (!k) {
      return {
        error: {
          code: "401",
          details: "unauthorized",
          hint: "no jwt secret found",
          message: "unauthorized access",
        },
        data: null,
        statusText: "unauthorized",
        count: null,
        status: 401,
      };
    }

    const auth = JSON.parse(k);
    this._inner.setHeader("Authorization", `Bearer ${auth.access_token}`);
    let response = await this._inner;

    if (response.error?.code == PG_UNAUTHORIZED) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push(async () => {
            try {
              const newAuth = JSON.parse(
                sessionStorage.getItem(AUTH_KEY) ?? "{}",
              );
              this._inner.setHeader(
                "Authorization",
                `Bearer ${newAuth.access_token}`,
              );
              let newResponse = await this._inner;
              if (newResponse.error?.code == PG_UNAUTHORIZED) {
                OrderService.instance.stopBackgroundPull();
                navigate("/login");
              }
              resolve(newResponse);
            } catch (e) {
              reject(e);
            }
          });
        });
      }

      isRefreshing = true;
      if (!(await refreshToken())) {
        navigate("/login");
        return response;
      }

      const newAuth = JSON.parse(sessionStorage.getItem(AUTH_KEY) ?? "{}");
      this._inner.setHeader("Authorization", `Bearer ${newAuth.access_token}`);
      response = await this._inner;
      isRefreshing = false;
      processRefreshQueue();
    }

    return response;
  }
}

async function refreshToken(): Promise<boolean> {
  const refresh_token = localStorage.getItem(AUTH_KEY);
  if (!refresh_token) {
    return false;
  }

  const { data, error } = await postgrest.rpc("refresh_token", {
    refresh_token,
  });
  if (error) return false;

  saveAuthToken(data);
  return true;
}

function processRefreshQueue() {
  while (refreshQueue.length > 0) {
    const callback = refreshQueue.shift();
    if (callback) callback();
  }
}
