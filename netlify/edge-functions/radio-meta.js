import { handleRadioRequest } from "../shared/radio-meta.mjs";

export default (_request, context) => handleRadioRequest(() => context.next());

export const config = { path: "/radio", onError: "bypass" };
