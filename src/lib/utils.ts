import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Filter, Sort } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseFiltersFromSearchParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): Filter[] {
  const filters: Filter[] = [];

  let urlSearchParams: URLSearchParams;
  if (searchParams instanceof URLSearchParams) {
    urlSearchParams = searchParams;
  } else {
    urlSearchParams = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => urlSearchParams.append(key, v));
        } else {
          urlSearchParams.append(key, value);
        }
      }
    });
  }

  urlSearchParams.forEach((value, key) => {
    const filterMatch = key.match(/^filters\[(.+)\]$/);
    if (filterMatch) {
      const column = filterMatch[1];
      // Parse operator from value (format: "operator:actual_value")
      const [operator, ...valueParts] = value.split(":");
      const actualValue = valueParts.join(":");
      if (actualValue.trim()) {
        filters.push({ column, operator, value: actualValue });
      }
    }
  });

  return filters;
}

export function parseSortsFromSearchParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): Sort[] {
  const sorts: Sort[] = [];

  let urlSearchParams: URLSearchParams;
  if (searchParams instanceof URLSearchParams) {
    urlSearchParams = searchParams;
  } else {
    urlSearchParams = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => urlSearchParams.append(key, v));
        } else {
          urlSearchParams.append(key, value);
        }
      }
    });
  }

  urlSearchParams.forEach((value, key) => {
    const sortMatch = key.match(/^sort\[(.+)\]$/);
    if (sortMatch) {
      const column = sortMatch[1];
      if (value === "asc" || value === "desc") {
        sorts.push({ column, direction: value });
      }
    }
  });

  return sorts;
}
