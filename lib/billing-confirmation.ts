import { checkoutGrant } from "./domain";
// The caller obtains this object from Stripe, never from a browser request body.
export function ownedCheckoutGrant(
  value: unknown,
  owner: string,
  project: string,
  customer: string,
) {
  const grant = checkoutGrant(value);
  const session = value as {
    status?: string;
    client_reference_id?: string;
    customer?: string | { id: string };
  } | null;
  const customerId =
    typeof session?.customer === "string"
      ? session.customer
      : session?.customer?.id;
  return grant &&
    session?.status === "complete" &&
    session.client_reference_id === owner &&
    grant.ownerId === owner &&
    grant.projectId === project &&
    customerId === customer
    ? grant
    : null;
}
