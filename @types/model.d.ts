interface User {
  fullname: string;
  email: string;
  role: "authenticated" | "admin";
}

type DeliveryStatus = "pending" | "delivered";

type BookConfig = Record<string, number>;

interface IOrder {
  _id?: string;
  agent_id?: string;
  id: string | number;
  source: string;
  email: string;
  fullname: string;
  phone: string;
  item: any;
  order_amount: number;
  address: string;
  state: string;
  delivery_status?: DeliveryStatus;
  delivery_cost?: number;
  office_charge?: number;
  books?: BookConfig;
  activities?: [];
  assigned_on?: string;
  confirmed_on?: string;
  delivered_on?: string;
  created_at: string;
}

type OrderSource = (param: SearchParam) => Promise<Omit<IOrder, "source">[]>;

interface SearchParam {
  start_date?: string;
  end_date?: string;
  limit: number;
  offset: number;
}

type IBalance = { value?: number; total?: number };

interface IAgent {
  id: string;
  fullname: string;
  phone: string;
  email?: string;
  state: string;
  books?: BookConfig;
}

interface IAffiliate {
  id: string;
  fullname: string;
  phone: string;
  email: string;
  source_list: string[];
}

interface DayStats {
  day: string;
  order_count: number;
  pending_count: number;
  delivered_count: number;
}

interface MonthStats {
  month: string;
  order_count: number;
  pending_count: number;
  delivered_count: number;
}
