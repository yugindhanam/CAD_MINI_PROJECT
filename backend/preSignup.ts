export async function handler(event: any) {
  const email = String(event.request.userAttributes.email || "").toLowerCase();
  if (
    email.split("@").length !== 2 ||
    email.split("@")[1] !== process.env.CAMPUS_DOMAIN?.toLowerCase()
  )
    throw Error("A campus email address is required");
  return event;
}
