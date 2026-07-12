import type { Operation } from "@swaggy/shared";
import type { RequestInputs } from "./buildProxyRequest.js";
import { validateParam } from "./fieldValidation.js";

export function validateInputs(op: Operation, inputs: RequestInputs): string[] {
  const errs: string[] = [];
  if (!inputs.server) errs.push("No server selected");

  // Required presence (exact messages preserved).
  for (const p of op.pathParams) if (p.required && !inputs.pathParams[p.name]) errs.push(`Missing required path parameter: ${p.name}`);
  for (const p of op.queryParams) if (p.required && inputs.query[p.name] === undefined) errs.push(`Missing required query parameter: ${p.name}`);
  for (const p of op.headerParams) if (p.required && !inputs.headers[p.name]) errs.push(`Missing required header: ${p.name}`);

  // Schema-driven validation of any value that was provided.
  for (const p of op.pathParams) { const e = validateParam(p, inputs.pathParams[p.name]); if (e) errs.push(`${p.name}: ${e}`); }
  for (const p of op.queryParams) { const e = validateParam(p, inputs.query[p.name]); if (e) errs.push(`${p.name}: ${e}`); }
  for (const p of op.headerParams) { const e = validateParam(p, inputs.headers[p.name]); if (e) errs.push(`${p.name}: ${e}`); }

  return errs;
}
