import {
  paymentConfig,
  paystack,
  readRaw,
  supabase,
} from "../../server/paystack.js";

export const config = { api: { bodyParser: false } };

export default async function handler(request, response) {
  if (request.method !== "POST")
    return response.status(405).json({ error: "Method not allowed." });
  const settings = paymentConfig();
  if (!settings)
    return response
      .status(503)
      .json({ error: "Credit purchases are unavailable at the moment." });
  const token =
    request.headers.authorization?.match(/^Bearer ([\w.-]+)$/i)?.[1];
  if (!token)
    return response.status(401).json({ error: "Sign in to buy credits." });
  let pack;
  try {
    pack = JSON.parse(await readRaw(request)).pack;
  } catch {
    return response.status(400).json({ error: "Invalid checkout request." });
  }
  if (typeof pack !== "string" || !/^[a-z0-9_-]{1,30}$/.test(pack))
    return response
      .status(400)
      .json({ error: "Choose an available credit pack." });
  try {
    const client = supabase(settings, token);
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(token);
    if (userError || !user?.email || !user.email_confirmed_at)
      return response
        .status(401)
        .json({ error: "Sign in with a confirmed email address." });
    const { data: payment, error } = await client.rpc("start_credit_payment", {
      p_pack: pack,
    });
    if (error || !payment)
      return response
        .status(400)
        .json({ error: error?.message || "Checkout couldn’t start." });
    const origin =
      process.env.SURVIVE9JA_SITE_URL || "https://survive9ja.vercel.app";
    const callback = new URL("/credits?checkout=1", origin);
    if (callback.protocol !== "https:") throw Error("Invalid checkout origin.");
    const checkout = await paystack(settings, "/transaction/initialize", {
      email: user.email,
      amount: payment.amount,
      currency: "NGN",
      reference: payment.reference,
      callback_url: callback.href,
    });
    const destination = new URL(checkout.authorization_url);
    if (
      destination.origin !== "https://checkout.paystack.com" ||
      checkout.reference !== payment.reference
    )
      throw Error("Unexpected checkout response.");
    return response.status(200).json({ url: destination.href });
  } catch {
    return response
      .status(502)
      .json({ error: "Checkout couldn’t start. Try again later." });
  }
}
