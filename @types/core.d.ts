type Primitive = number | string | boolean;
type NullString = string | null;
interface Array {
  unique(): this;
  sum(): number;
  isEmpty(): boolean;
}

interface Map<K, V> {
  toArray(): Array<V>;
  isEmpty(): boolean;
  json(): Record<string, V>;
}

interface Number {
  asLocalCurrency(): string | undefined;
}

interface Api<T = Any> {
  status: "success" | "failed";
  $meta?: Record<string, string>;
  data: T;
}

interface Disabled {
  disabled?: boolean;
}

interface ID {
  getID(): string;
}

type Validator = (txt?: NullString) => NullString;
