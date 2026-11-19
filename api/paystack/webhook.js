import {
  paymentConfig,
  paystack,
  readRaw,
  supabase,
  validSignature,
} from "../../server/paystack.js";

export const config = { api: { bodyParser: false } };

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).end();
  const settings = paymentConfig();
  if (!settings) return response.status(503).end();
  let raw;
  try {
    raw = await readRaw(request);
  } catch {
    return response.status(400).end();
  }
  if (
    !validSignature(
      settings.secret,
      raw,
      request.headers["x-paystack-signature"],
    )
  )
    return response.status(401).end();
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return response.status(400).end();
  }
  if (event?.event !== "charge.success") return response.status(200).end();
  const reference = event.data?.reference;
  if (
    typeof reference !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(reference)
  )
    return response.status(200).end();
  try {
    const charge = await paystack(settings, "/transaction/verify/" + reference);
    if (
      charge.status !== "success" ||
      charge.reference !== reference ||
      charge.domain !== settings.mode ||
      charge.currency !== "NGN" ||
      !Number.isSafeInteger(charge.amount)
    )
      return response.status(400).end();
    const result = await supabase(settings).rpc("settle_credit_payment", {
      p_reference: reference,
      p_amount: charge.amount,
      p_currency: charge.currency,
    });
    if (result.error) return response.status(503).end();
    return response.status(result.data === true ? 200 : 400).end();
  } catch {
    return response.status(503).end();
  }
}
