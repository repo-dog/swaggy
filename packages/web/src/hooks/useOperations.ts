import { useQuery } from "@tanstack/react-query";
import { getSpecs, getOperations } from "../lib/api.js";

export const useSpecs = () => useQuery({ queryKey: ["specs"], queryFn: getSpecs });
export const useOperations = () => useQuery({ queryKey: ["operations"], queryFn: getOperations });
