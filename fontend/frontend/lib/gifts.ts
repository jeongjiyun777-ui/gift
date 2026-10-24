export interface Gift {
  id: number;
  name: string;
  amount: number;
  direction: "received" | "paid";
  category: string | null;
  detail: string | null;
  location: string | null;
  paid_on: string | null;
}

export function giftEndpoint(direction: Gift["direction"]) {
  return direction === "paid" ? "/paid-gifts" : "/gifts";
}

export function displayGiftText(value: string | null | undefined) {
  return value?.trim() || "-";
}
